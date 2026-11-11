import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';
import * as cheerio from 'cheerio';

/**
 * WeebCentral Adapter (weebcentral.com)
 * - Server-rendered HTML + HTMX fragments. Only a browser User-Agent is needed (no JS challenge, no cookies).
 * - Listing: `/` (homepage cover cards). Search: `/search/data?text=...&display_mode=Full+Display` (hard cap ~32, no pagination).
 * - Details: `/series/<ULID>/<slug>`. Chapters: `<seriesPath>/chapter-select?current_chapter=<any-id>` (all rows, no pagination).
 * - Reader images: `/chapters/<CHID>/images?is_prev=False&reading_style=long_strip&current_page=1` -> `#chapter-images img[src]`.
 */
export class WeebcentralSource extends BaseSource {
	id = 'weebcentral';
	name = 'WeebCentral';
	baseUrl = 'https://weebcentral.com';

	protected override headers: Record<string, string> = {
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
		Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'Accept-Language': 'en-US,en;q=0.5'
	};

	/** WeebCentral's CDN throttles bursts (307 -> /404), so space every request. */
	private static lastAt = 0;
	protected override async fetchHtml(path: string): Promise<string> {
		const gap = 1500;
		const wait = WeebcentralSource.lastAt + gap - Date.now();
		if (wait > 0) await new Promise((r) => setTimeout(r, wait));
		WeebcentralSource.lastAt = Date.now();
		return super.fetchHtml(path);
	}

	private abs(src: string): string {
		if (!src) return '';
		if (src.startsWith('http')) return src;
		if (src.startsWith('//')) return `https:${src}`;
		return `${this.baseUrl}${src.startsWith('/') ? '' : '/'}${src}`;
	}

	private clean(s: string): string {
		return (s || '').replace(/\s+/g, ' ').trim();
	}

	private toPath(href: string): string {
		if (!href) return '';
		return href.startsWith('http') ? new URL(href).pathname : href;
	}

	/**
	 * Chapter list, with release times. `/series/<id>/full-chapter-list` is the rich fragment:
	 * one row per chapter (including the newest, which `chapter-select` renders as a button,
	 * not a link) each with a `<time datetime>`. It intermittently redirects to a /404 page
	 * that still answers HTTP 200, so fall back to `chapter-select` (chapters only, no dates).
	 */
	private async fetchChapterList(seriesPath: string, seed: string): Promise<string> {
		const id = seriesPath.match(/\/series\/([^/]+)/)?.[1];
		if (!id) return '';
		try {
			const full = await this.fetchHtml(`/series/${id}/full-chapter-list`);
			if (/<time[^>]*datetime=/.test(full)) return full;
		} catch {}
		if (!seed) return '';
		try {
			return await this.fetchHtml(
				`/series/${id}/chapter-select?current_chapter=${encodeURIComponent(seed)}`
			);
		} catch {
			return '';
		}
	}

	/** Parse /series/<ULID>/<slug> anchors that carry a cover image into Manga cards (search + homepage). */
	private cards($: cheerio.CheerioAPI): Manga[] {
		const res: Manga[] = [];
		const seen = new Set<string>();
		// data-tip on WeebCentral cards is often a type badge ("Manga", "Anime
		// Adaptation", ...) rather than the title, so never let it win.
		const badges = new Set(['manga', 'anime adaptation', 'official translation', 'manhwa', 'manhua']);
		const tip = (s: string): string => {
			const v = this.clean(s);
			return v && !badges.has(v.toLowerCase()) ? v : '';
		};
		$('a[href*="/series/"]').each((_, el) => {
			const $a = $(el);
			const id = this.toPath($a.attr('href') || '');
			// Only /series/<id>/<slug> (two segments), never chapter/series-index links.
			if (!/^\/series\/[^/]+\/[^/]+$/.test(id)) return;
			if (seen.has(id)) return;

			const img = $a.find('img').first();
			const src = img.attr('src') || img.attr('data-src') || '';
			// Real cover cards embed an <img>; the plain "Recently Added"/"Popular" anchor
			// lists do not — skip them so we never borrow a sibling card's cover.
			if (!src) return;

			const title =
				this.clean(img.attr('alt') || '').replace(/\s*cover$/i, '') ||
				tip($a.closest('[data-tip]').attr('data-tip') || '') ||
				tip($('span.tooltip', $a).first().attr('data-tip') || '') ||
				this.clean($a.text()) ||
				decodeURIComponent(id.split('/').pop() || '').replace(/-/g, ' ');

			if (!title) return;
			seen.add(id);
			res.push({ id, title, cover: this.abs(src), sourceId: this.id });
		});
		return res;
	}

	/**
	 * The homepage ignores `?page=N` (identical bytes for every N). Real pagination
	 * lives in its HTMX fragment feeds: `/latest-updates/<n>` (32/page) and
	 * `/recently-added/<n>` (10/page). We use latest-updates; consecutive pages are disjoint.
	 */
	async getLatestManga(page: number): Promise<Manga[]> {
		const p = Number.isFinite(page) && page > 1 ? Math.floor(page) : 1;
		try {
			const html = await this.fetchHtml(`/latest-updates/${p}`);
			return this.cards(cheerio.load(html));
		} catch (e) {
			console.error('[WeebCentral] getLatestManga failed:', e);
			return [];
		}
	}

	/**
	 * Search is paginated by `/search/data?limit=32&offset=<n*32>&text=...&display_mode=Full+Display`.
	 * `limit` is fixed at 32 by the server regardless of value; `?page=N` is ignored.
	 * The fragment ends with a "View More Results..." button (hx-get the next offset)
	 * or a "No results found" alert when exhausted.
	 */
	async searchManga(query: string, page = 1): Promise<Manga[]> {
		const p = Number.isFinite(page) && page > 1 ? Math.floor(page) : 1;
		const offset = (p - 1) * 32;
		try {
			const html = await this.fetchHtml(
				`/search/data?limit=32&offset=${offset}&text=${encodeURIComponent(query)}&display_mode=Full+Display`
			);
			return this.cards(cheerio.load(html));
		} catch (e) {
			console.error('[WeebCentral] searchManga failed:', e);
			return [];
		}
	}

	/** Parse chapter rows: <a href=".../chapters/<ID>">Chapter N</a> plus the row's date. */
	private extractChapters($: cheerio.CheerioAPI): Chapter[] {
		const chapters: Chapter[] = [];
		const seen = new Set<string>();
		$('a[href*="/chapters/"]').each((_, el) => {
			const $a = $(el);
			const id = this.toPath($a.attr('href') || '');
			if (!/^\/chapters\/[^/]+$/.test(id) || seen.has(id)) return;
			seen.add(id);
			const text = this.clean($a.text());
			const numMatch = text.match(/chapter\s*([\d.]+)/i);
			const number = numMatch ? parseFloat(numMatch[1]) : 0;
			// The row wrapper holds the release time, as <time datetime> or in checkNewChapter().
			const row = $a.closest('div');
			const date =
				this.clean(row.find('time[datetime]').first().attr('datetime') || '') ||
				this.clean(row.attr('x-data')?.match(/checkNewChapter\('([^']+)'\)/)?.[1] || '');
			chapters.push({ id, title: text || `Chapter ${number}`, number, date });
		});
		chapters.sort((a, b) => b.number - a.number);
		return chapters;
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		let path = this.toPath(mangaId);
		// A chapter path (/chapters/<ULID>) is not a series page. The chapter page
		// contains back-links to its series; resolve the first /series/<id>/<slug>.
		if (/^\/chapters\/[^/]+$/.test(path)) {
			const $ch = cheerio.load(await this.fetchHtml(path));
			const seriesPath = $ch('a[href*="/series/"]')
				.toArray()
				.map((el) => this.toPath($ch(el).attr('href') || ''))
				.find((p) => /^\/series\/[^/]+\/[^/]+$/.test(p));
			if (seriesPath) path = seriesPath;
		}
		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);

		// Chapters: seed from an inline chapter link, then expand via chapter-select.
		const seed =
			this.toPath($('a[href*="/chapters/"]').first().attr('href') || '')
				.split('/')
				.pop() || '';
		const chapters = this.extractChapters(cheerio.load(await this.fetchChapterList(path, seed)));

		const title =
			this.clean($('h1.hidden.md\\:block').first().text()) ||
			this.clean($('h1').first().text()) ||
			this.clean($('meta[property="og:title"]').attr('content') || '') ||
			path;

		const cover = this.abs(
			$('meta[property="og:image"]').attr('content') ||
				$('img[src*="/cover/"]').first().attr('src') ||
				''
		);

		// Meta rows are <li><strong>Label(s): </strong> ...value...</li>
		const norm = (s: string) =>
			this.clean(s)
				.toLowerCase()
				.replace(/[^a-z]/g, '');
		const metaOf = (label: string): string => {
			const want = norm(label);
			let val = '';
			$('li').each((_, el) => {
				const $li = $(el);
				if (val) return;
				if (norm($li.find('strong').first().text()).startsWith(want)) {
					val = this.clean($li.clone().find('strong').remove().end().text());
				}
			});
			return val;
		};

		const authors: string[] = [];
		for (const a of [metaOf('Author'), metaOf('Artist')]) {
			for (const part of a.split(/[,;]/)) {
				const n = this.clean(part);
				if (n && !authors.includes(n)) authors.push(n);
			}
		}

		const status =
			this.clean($('a[href*="included_status="]').first().text()) || metaOf('Status') || 'Ongoing';

		const genres: string[] = [];
		$('a[href*="included_tag="]').each((_, el) => {
			const g = this.clean($(el).text());
			if (g && !genres.some((x) => x.toLowerCase() === g.toLowerCase())) genres.push(g);
		});

		const description =
			this.clean($('li p.whitespace-pre-wrap').first().text()) ||
			this.clean($('p.whitespace-pre-wrap').first().text());

		return {
			id: path,
			sourceId: this.id,
			title,
			cover,
			description,
			authors,
			status,
			genres,
			chapters
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const path = this.toPath(chapterId);
		const html = await this.fetchHtml(
			`${path}/images?is_prev=False&reading_style=long_strip&current_page=1`
		);
		const $ = cheerio.load(html);
		const images: string[] = [];
		$('#chapter-images img, img[src*="/manga/"]').each((_, el) => {
			const src = $(el).attr('src') || $(el).attr('data-src') || '';
			if (src) {
				const a = this.abs(src);
				if (!images.includes(a)) images.push(a);
			}
		});
		return images;
	}
}
