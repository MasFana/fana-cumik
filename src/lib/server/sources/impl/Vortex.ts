import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';
import * as cheerio from 'cheerio';

/**
 * VortexScans Adapter (vortexscans.org)
 * - Listing/search: /series?page=N | /series?searchTerm=...
 * - Details: HTML SSR. Description div[itemprop="description"], genres a[href*="genres="].
 * - Chapters: <dl> metadata + chapter anchors with span.font-medium title and <time> date.
 */
export class VortexSource extends BaseSource {
	id = 'vortex';
	name = 'VortexScans';
	baseUrl = 'https://vortexscans.org';

	private abs(src: string): string {
		if (!src) return '';
		if (src.startsWith('http')) return src;
		if (src.startsWith('//')) return `https:${src}`;
		return `${this.baseUrl}${src.startsWith('/') ? '' : '/'}${src}`;
	}

	private clean(s: string): string {
		return (s || '').replace(/\s+/g, ' ').trim();
	}

	private cards($: cheerio.CheerioAPI): Manga[] {
		const res: Manga[] = [];
		$('a[href*="/series/"]').each((_, el) => {
			const $a = $(el);
			const href = $a.attr('href') || '';
			// Chapter links live under /series/<slug>/chapter-... — never treat as manga
			if (/\/chapter[-/]/i.test(href)) return;
			const img = $a.find('img').first();
			const src = img.attr('src') || img.attr('data-src') || '';
			const title = this.clean(img.attr('alt') || '') || this.clean($a.find('h3, h2, .title').first().text());
			if (href && title) {
				const id = href.startsWith('http') ? new URL(href).pathname : href;
				res.push({ id, title, cover: this.abs(src), sourceId: this.id });
			}
		});
		// dedupe by id
		return res.filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i);
	}

	async getLatestManga(page: number): Promise<Manga[]> {
		try {
			const html = await this.fetchHtml(`/series?page=${page}`);
			return this.cards(cheerio.load(html));
		} catch (e) {
			console.error('[Vortex] getLatestManga failed:', e);
			return [];
		}
	}

	async searchManga(query: string): Promise<Manga[]> {
		try {
			const html = await this.fetchHtml(`/series?searchTerm=${encodeURIComponent(query)}`);
			return this.cards(cheerio.load(html));
		} catch (e) {
			console.error('[Vortex] searchManga failed:', e);
			return [];
		}
	}

	/** Read the <dl> metadata rows: <dt>Label</dt><dd>value</dd> */
	private metaMap($: cheerio.CheerioAPI): Record<string, string> {
		const out: Record<string, string> = {};
		$('dl dt').each((_, el) => {
			const $dt = $(el);
			const key = this.clean($dt.text()).toLowerCase();
			const val = this.clean($dt.next('dd').text());
			if (key && val) out[key] = val;
		});
		return out;
	}

	private extractGenres($: cheerio.CheerioAPI): string[] {
		const genres: string[] = [];
		$('a[itemprop="genre"], a[href*="genres="]').each((_, el) => {
			const g = this.clean($(el).text());
			if (g && !genres.some((x) => x.toLowerCase() === g.toLowerCase())) genres.push(g);
		});
		return genres;
	}

	private extractDescription($: cheerio.CheerioAPI): string {
		const primary = this.clean($('[itemprop="description"]').first().text());
		if (primary) return primary;
		const fallback = this.clean($('.description, .synopsis, .summary').first().text());
		if (fallback) return fallback;
		// Last resort: the "Summary" tab panel body
		const panel = $('section[data-series-tab-panel="description"]').first().text();
		return this.clean(panel);
	}

	private extractChapters($: cheerio.CheerioAPI, slug: string, html: string): Chapter[] {
		// Payload-first: the SSR anchor list below is partial (the hero button and
		// some rows are dropped), but the dehydrated SvelteKit payload in the same
		// HTML lists every chapter. Only the relative dates live in the anchors.
		const payloadRe = /\{id:\d+,slug:"(chapter-[\d.]+)",number:([\d.]+),title:"([^"]*)"/g;
		const payload = slug
			? Array.from(html.matchAll(payloadRe)).map((m) => {
					const number = parseFloat(m[2]);
					return {
						id: `/series/${slug}/${m[1]}`,
						number,
						title: this.clean(m[3]) || `Chapter ${number}`
					};
				})
			: [];

		const chapters: Chapter[] = [];
		const datesByNumber = new Map<number, string>();
		const seen = new Set<string>();
		const scope = slug ? `a[href*="/series/${slug}/chapter"]` : 'a[href*="/chapter"]';

		$(scope).each((_, el) => {
			const $el = $(el);
			const href = $el.attr('href') || '';
			if (!href) return;
			// Skip the hero "Start Reading" button
			if ($el.find('[data-continue-label]').length || /start reading/i.test($el.text())) return;

			const id = href.startsWith('http') ? new URL(href).pathname : href;
			if (seen.has(id)) return;
			seen.add(id);

			const numMatch = id.match(/chapter[-/](\d+(?:[.-]\d+)?)/i);
			const number = numMatch ? parseFloat(numMatch[1].replace('-', '.')) : 0;

			// Title lives in span.font-medium (or the first span); "New" badge and
			// the relative date are siblings and must not leak into the label.
			let title = this.clean($el.find('span.font-medium, span[class*="font-medium"]').first().text());
			if (!title) {
				const clone = $el.clone();
				clone.find('time, svg, img, button, [class*="dot-animation"]').remove();
				title = this.clean(clone.text());
			}
			title = title
				.replace(/\bNew\b/gi, '')
				.replace(/\b\d+\s*(?:sec|min|hour|day|week|month|year)s?(?:\s+ago)?\b/gi, '')
				.replace(/^(?:Chapter\s*)+/i, 'Chapter ')
				.trim();
			if (!title || /^chapter\s*$/i.test(title) || /^\d+(?:\.\d+)?$/.test(title)) {
				title = number ? `Chapter ${number}` : 'Chapter';
			}

			const $time = $el.find('time').first();
			const date = this.clean(
				$time.text() || $time.attr('datetime') || $time.attr('dateTime') || $el.find('span[title]').attr('title') || ''
			);

			chapters.push({ id, title, number, date });
			if (date) datesByNumber.set(number, date);
		});

		if (payload.length > 0) {
			return payload
				.map((c) => ({ ...c, date: datesByNumber.get(c.number) || '' }))
				.filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i)
				.sort((a, b) => b.number - a.number);
		}

		chapters.sort((a, b) => b.number - a.number);
		return chapters;
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		const path = mangaId.startsWith('http') ? new URL(mangaId).pathname : mangaId;
		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);

		const title = this.clean($('h1').first().text()) || path;
		// Cover: the real cover carries itemprop="image". Older markup matched on
		// 'cover'/'thumbnail' in the URL. Never fall back to $('img').first() —
		// that is the site logo.
		const coverSrc =
			$('img[itemprop="image"]').first().attr('src') ||
			$('img')
				.filter((_, el) => {
					const s = $(el).attr('src') || '';
					return s.includes('cover') || s.includes('thumbnail');
				})
				.first()
				.attr('src') ||
			'';
		const cover = this.abs(coverSrc);

		const meta = this.metaMap($);
		const authors: string[] = [];
		for (const k of ['author', 'artist']) {
			if (meta[k]) {
				for (const a of meta[k].split(/[,;]/)) {
					const name = this.clean(a);
					if (name && !authors.includes(name)) authors.push(name);
				}
			}
		}

		const slugMatch = path.match(/\/series\/([^/]+)/);
		const slug = slugMatch ? slugMatch[1] : '';

		return {
			id: path,
			sourceId: this.id,
			title,
			cover,
			description: this.extractDescription($),
			authors,
			status: meta['status'] || 'Ongoing',
			genres: this.extractGenres($),
			chapters: this.extractChapters($, slug, html)
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const path = chapterId.startsWith('http') ? new URL(chapterId).pathname : chapterId;
		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);
		const images: string[] = [];

		// Payload-first: reader pages ship no <img>; page images live only in the
		// dehydrated payload as `displaySrc:"..."`, already ordered page-0001..N.
		// Locked/paid chapters legitimately have none — [] is correct there.
		const payload = Array.from(html.matchAll(/displaySrc:"(https:[^"]+)"/g)).map((m) => m[1]);
		if (payload.length > 0) return [...new Set(payload)];

		// Primary: reader pages are tagged with data-reader-page-image / data-reader-index
		const tagged = $('img[data-reader-page-image]').toArray();
		if (tagged.length > 0) {
			tagged
				.map((el) => ({ el, idx: parseInt($(el).attr('data-reader-index') || '0', 10) || 0 }))
				.sort((a, b) => a.idx - b.idx)
				.forEach(({ el }) => {
					const src = $(el).attr('src') || $(el).attr('data-src') || '';
					if (src) {
						const abs = this.abs(src);
						if (!images.includes(abs)) images.push(abs);
					}
				});
			return images;
		}

		$('img').each((_, el) => {
			const src = $(el).attr('src') || $(el).attr('data-src') || '';
			if (src && /\/page-\d+[^/]*\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(src)) {
				const abs = this.abs(src);
				if (!images.includes(abs)) images.push(abs);
			}
		});
		if (images.length === 0) {
			$('.reader-container img, #chapter-content img, .chapter-img').each((_, el) => {
				const src = $(el).attr('src') || $(el).attr('data-src') || '';
				if (src) images.push(this.abs(src));
			});
		}
		return images;
	}
}
