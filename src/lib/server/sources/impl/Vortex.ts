import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';

/**
 * VortexScans Adapter (vortexscans.org)
 * - Listing/search: /series?page=N | /series?searchTerm=...
 * - Details: HTML SSR. Description div[itemprop="description"], genres a[href*="genres="].
 * - Chapters: <dl> metadata + chapter anchors with span.font-medium title and <time> date.
 *
 * Parsing is regex over the raw HTML (no DOM); see BaseSource for the readers.
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

	private firstImg(html: string): string {
		const tag = BaseSource.tag(html, /<img\b[^>]*>/i);
		return BaseSource.attr(tag, 'src') || BaseSource.attr(tag, 'data-src');
	}

	/** `$anchor.find('h3, h2, .title').first()`: the earliest of the three in `html`. */
	private heading(html: string): string {
		const at = [
			html.search(/<h3\b/i),
			html.search(/<h2\b/i),
			html.search(/<[a-z][a-z0-9]*\b[^>]*\bclass="[^"]*\btitle\b[^"]*"[^>]*>/i)
		]
			.filter((i) => i >= 0)
			.sort((a, b) => a - b)[0];
		return at === undefined ? '' : this.clean(BaseSource.text(BaseSource.elementAt(html, at)));
	}

	private cards(html: string): Manga[] {
		const res: Manga[] = [];
		for (const { body } of BaseSource.records(
			html,
			/<a\b[^>]*href="[^"]*\/series\/[^"]*"[^>]*>/gi
		)) {
			const href = BaseSource.attr(BaseSource.open(body), 'href');
			// Chapter links live under /series/<slug>/chapter-... — never treat as manga
			if (!href || /\/chapter[-/]/i.test(href)) continue;
			const image = this.firstImg(body);
			const title =
				this.clean(BaseSource.attr(BaseSource.tag(body, /<img\b[^>]*>/i), 'alt')) ||
				this.heading(body);
			if (title) {
				const id = href.startsWith('http') ? new URL(href).pathname : href;
				res.push({ id, title, cover: this.abs(image), sourceId: this.id });
			}
		}
		// dedupe by id
		return res.filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i);
	}

	async getLatestManga(page: number): Promise<Manga[]> {
		try {
			const html = await this.fetchHtml(`/series?page=${page}`);
			return this.cards(html);
		} catch (e) {
			console.error('[Vortex] getLatestManga failed:', e);
			return [];
		}
	}

	async searchManga(query: string): Promise<Manga[]> {
		try {
			const html = await this.fetchHtml(`/series?searchTerm=${encodeURIComponent(query)}`);
			return this.cards(html);
		} catch (e) {
			console.error('[Vortex] searchManga failed:', e);
			return [];
		}
	}

	/** Read the <dl> metadata rows: <dt>Label</dt><dd>value</dd> */
	private metaMap(html: string): Record<string, string> {
		const out: Record<string, string> = {};
		for (const { body } of BaseSource.records(html, /<dt\b[^>]*>/gi)) {
			const key = this.clean(BaseSource.text(BaseSource.inner(body, 'dt'))).toLowerCase();
			// The dd is the very next sibling of the dt, so it follows its close tag.
			const after = body.slice(body.search(/<\/dt>/i) + '</dt>'.length);
			const dd = after.match(/^\s*<dd\b/i);
			if (!key || !dd) continue;
			const val = this.clean(BaseSource.text(BaseSource.inner(after.slice(dd.index ?? 0), 'dd')));
			if (val) out[key] = val;
		}
		return out;
	}

	private extractGenres(html: string): string[] {
		const genres: string[] = [];
		for (const tag of BaseSource.tags(
			html,
			/<a\b[^>]*\sitemprop="genre"[^>]*>[\s\S]*?<\/a>|<a\b[^>]*href="[^"]*genres=[^"]*"[^>]*>[\s\S]*?<\/a>/gi
		)) {
			const g = this.clean(BaseSource.text(tag));
			if (g && !genres.some((x) => x.toLowerCase() === g.toLowerCase())) genres.push(g);
		}
		return genres;
	}

	private extractDescription(html: string): string {
		const primary = this.clean(
			BaseSource.text(BaseSource.element(html, 'itemprop', 'description'))
		);
		if (primary) return primary;
		const starts = [
			html.search(/<[a-z][a-z0-9]*\b[^>]*\bclass="[^"]*\bdescription\b[^"]*"[^>]*>/i),
			html.search(/<[a-z][a-z0-9]*\b[^>]*\bclass="[^"]*\bsynopsis\b[^"]*"[^>]*>/i),
			html.search(/<[a-z][a-z0-9]*\b[^>]*\bclass="[^"]*\bsummary\b[^"]*"[^>]*>/i)
		]
			.filter((i) => i >= 0)
			.sort((a, b) => a - b);
		if (starts.length) return this.clean(BaseSource.text(BaseSource.elementAt(html, starts[0])));
		// Last resort: the "Summary" tab panel body
		const at = html.search(/<section\b[^>]*\bdata-series-tab-panel="description"[^>]*>/i);
		return at < 0 ? '' : this.clean(BaseSource.text(BaseSource.elementAt(html, at)));
	}

	private extractChapters(html: string, slug: string): Chapter[] {
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
		const scope = slug ? `/series/${slug}/chapter` : '/chapter';

		// The href is entity-encoded in the raw HTML (`&#x27;` for an apostrophe in the
		// slug), so the slug is compared after decoding, not by the selector.
		for (const { body } of BaseSource.records(
			html,
			/<a\b[^>]*href="[^"]*\/chapter[^"]*"[^>]*>/gi
		)) {
			const href = BaseSource.attr(BaseSource.open(body), 'href');
			if (!href || !href.includes(scope)) continue;
			const inner = BaseSource.inner(body, 'a');
			// Skip the hero "Start Reading" button
			if (/data-continue-label/i.test(inner) || /start reading/i.test(BaseSource.text(inner)))
				continue;

			const id = href.startsWith('http') ? new URL(href).pathname : href;
			if (seen.has(id)) continue;
			seen.add(id);

			const numMatch = id.match(/chapter[-/](\d+(?:[.-]\d+)?)/i);
			const number = numMatch ? parseFloat(numMatch[1].replace('-', '.')) : 0;

			// Title lives in span.font-medium (or the first span); "New" badge and
			// the relative date are siblings and must not leak into the label.
			let title = this.clean(
				BaseSource.text(
					BaseSource.tag(
						inner,
						/<span\b[^>]*\bclass="[^"]*\bfont-medium\b[^"]*"[^>]*>[\s\S]*?<\/span>/i
					)
				)
			);
			if (!title) {
				const stripped = inner
					.replace(/<time\b[^>]*>[\s\S]*?<\/time>/gi, '')
					.replace(/<(svg|button)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
				title = this.clean(BaseSource.text(stripped));
			}
			title = title
				.replace(/\bNew\b/gi, '')
				.replace(/\b\d+\s*(?:sec|min|hour|day|week|month|year)s?(?:\s+ago)?\b/gi, '')
				.replace(/^(?:Chapter\s*)+/i, 'Chapter ')
				.trim();
			if (!title || /^chapter\s*$/i.test(title) || /^\d+(?:\.\d+)?$/.test(title)) {
				title = number ? `Chapter ${number}` : 'Chapter';
			}

			const time = BaseSource.tag(inner, /<time\b[^>]*>[\s\S]*?<\/time>/i);
			const date = this.clean(
				BaseSource.text(time) ||
					BaseSource.attr(time, 'datetime') ||
					BaseSource.attr(time, 'dateTime') ||
					BaseSource.attr(BaseSource.tag(inner, /<span\b[^>]*\btitle="[^"]*"[^>]*>/i), 'title') ||
					''
			);

			chapters.push({ id, title, number, date });
			if (date) datesByNumber.set(number, date);
		}

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

		const title =
			this.clean(BaseSource.text(BaseSource.tag(html, /<h1\b[^>]*>[\s\S]*?<\/h1>/i))) || path;
		// Cover: the real cover carries itemprop="image". Older markup matched on
		// 'cover'/'thumbnail' in the URL. Never fall back to the site logo, which is
		// the first <img> on the page.
		let coverSrc = BaseSource.attr(
			BaseSource.tag(html, /<img\b[^>]*\sitemprop="image"[^>]*>/i),
			'src'
		);
		if (!coverSrc) {
			for (const { body } of BaseSource.records(html, /<img\b[^>]*>/gi)) {
				const src = BaseSource.attr(body, 'src');
				if (src.includes('cover') || src.includes('thumbnail')) {
					coverSrc = src;
					break;
				}
			}
		}
		const cover = this.abs(coverSrc);

		const meta = this.metaMap(html);
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
			description: this.extractDescription(html),
			authors,
			status: meta['status'] || 'Ongoing',
			genres: this.extractGenres(html),
			chapters: this.extractChapters(html, slug)
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const path = chapterId.startsWith('http') ? new URL(chapterId).pathname : chapterId;
		const html = await this.fetchHtml(path);
		const images: string[] = [];

		// Payload-first: reader pages ship no <img>; page images live only in the
		// dehydrated payload as `displaySrc:"..."`, already ordered page-0001..N.
		// Locked/paid chapters legitimately have none — [] is correct there.
		const payload = Array.from(html.matchAll(/displaySrc:"(https:[^"]+)"/g)).map((m) => m[1]);
		if (payload.length > 0) return [...new Set(payload)];

		// Fallbacks, in the order the old selector list tried them.
		const tagged: { src: string; idx: number }[] = [];
		for (const { body } of BaseSource.records(
			html,
			/<img\b[^>]*\bdata-reader-page-image\b[^>]*>/gi
		)) {
			const src = BaseSource.attr(body, 'src') || BaseSource.attr(body, 'data-src');
			const idx = parseInt(BaseSource.attr(body, 'data-reader-index') || '0', 10) || 0;
			if (src) tagged.push({ src: this.abs(src), idx });
		}
		if (tagged.length > 0) {
			tagged
				.sort((a, b) => a.idx - b.idx)
				.forEach(({ src }) => {
					if (!images.includes(src)) images.push(src);
				});
			return images;
		}

		for (const { body } of BaseSource.records(html, /<img\b[^>]*>/gi)) {
			const src = BaseSource.attr(body, 'src') || BaseSource.attr(body, 'data-src');
			if (src && /\/page-\d+[^/]*\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(src)) {
				const abs = this.abs(src);
				if (!images.includes(abs)) images.push(abs);
			}
		}
		if (images.length === 0) {
			const at = [
				html.search(/class="[^"]*\breader-container\b[^"]*"/i),
				html.search(/id="chapter-content"/i),
				html.search(/class="[^"]*\bchapter-img\b[^"]*"/i)
			]
				.filter((i) => i >= 0)
				.sort((a, b) => a - b)[0];
			const region = at === undefined ? '' : BaseSource.elementAt(html, at);
			for (const { body } of BaseSource.records(region, /<img\b[^>]*>/gi)) {
				const src = BaseSource.attr(body, 'src') || BaseSource.attr(body, 'data-src');
				if (src) images.push(this.abs(src));
			}
		}
		return images;
	}
}
