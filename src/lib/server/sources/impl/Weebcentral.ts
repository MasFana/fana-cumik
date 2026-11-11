import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';

/**
 * WeebCentral Adapter (weebcentral.com)
 * - Server-rendered HTML + HTMX fragments. Only a browser User-Agent is needed (no JS challenge, no cookies).
 * - Listing: `/` (homepage cover cards). Search: `/search/data?text=...&display_mode=Full+Display` (hard cap ~32, no pagination).
 * - Details: `/series/<ULID>/<slug>`. Chapters: `<seriesPath>/chapter-select?current_chapter=<any-id>` (all rows, no pagination).
 * - Reader images: `/chapters/<CHID>/images?is_prev=False&reading_style=long_strip&current_page=1` -> `#chapter-images img[src]`.
 *
 * Parsing is regex over the raw HTML (no DOM): these pages are flat record lists,
 * so one pass per record beats building a tree. See BaseSource for the readers.
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

	private static readonly SERIES_PATH = /^\/series\/[^/]+\/[^/]+$/;
	private static readonly CHAPTER_PATH = /^\/chapters\/[^/]+$/;

	/** Series path of the first back-link in a chapter page (its own series). */
	private seriesPath(html: string): string {
		for (const { body } of BaseSource.records(html, /<a\b/gi)) {
			const path = this.toPath(BaseSource.attr(BaseSource.open(body), 'href'));
			if (WeebcentralSource.SERIES_PATH.test(path)) return path;
		}
		return '';
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
	private cards(html: string): Manga[] {
		const res: Manga[] = [];
		const seen = new Set<string>();
		// data-tip on WeebCentral cards is often a type badge ("Manga", "Anime
		// Adaptation", ...) rather than the title, so never let it win.
		const badges = new Set(['manga', 'anime adaptation', 'official translation', 'manhwa', 'manhua']);
		const tip = (s: string): string => {
			const v = this.clean(s);
			return v && !badges.has(v.toLowerCase()) ? v : '';
		};

		for (const { before, body } of BaseSource.records(html, /<a\b/gi)) {
			const id = this.toPath(BaseSource.attr(BaseSource.open(body), 'href'));
			// Only /series/<id>/<slug> (two segments), never chapter/series-index links.
			if (!WeebcentralSource.SERIES_PATH.test(id) || seen.has(id)) continue;

			const img = BaseSource.tag(body, /<img\b[^>]*>/i);
			const src = BaseSource.attr(img, 'src') || BaseSource.attr(img, 'data-src');
			// Real cover cards embed an <img>; the plain "Recently Added"/"Popular" anchor
			// lists do not — skip them so we never borrow a sibling card's cover.
			if (!src) continue;

			const inner = BaseSource.inner(body, 'a');
			// The card's own [data-tip] sits on a wrapper just before the anchor.
			const priorTip = BaseSource.tags(before, /<[^>]*\bdata-tip\s*=[^>]*>/gi).pop() || '';
			const title =
				this.clean(BaseSource.attr(img, 'alt')).replace(/\s*cover$/i, '') ||
				tip(BaseSource.attr(priorTip, 'data-tip')) ||
				tip(BaseSource.attr(BaseSource.tag(inner, /<span[^>]*\btooltip\b[^>]*>/i), 'data-tip')) ||
				this.clean(BaseSource.text(inner)) ||
				decodeURIComponent(id.split('/').pop() || '').replace(/-/g, ' ');

			if (!title) continue;
			seen.add(id);
			res.push({ id, title, cover: this.abs(src), sourceId: this.id });
		}
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
			return this.cards(await this.fetchHtml(`/latest-updates/${p}`));
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
			return this.cards(html);
		} catch (e) {
			console.error('[WeebCentral] searchManga failed:', e);
			return [];
		}
	}

	/** Parse chapter rows: <a href=".../chapters/<ID>">Chapter N</a> plus the row's date. */
	private extractChapters(html: string): Chapter[] {
		const chapters: Chapter[] = [];
		const seen = new Set<string>();
		for (const { before, body } of BaseSource.records(html, /<a\b/gi)) {
			const id = this.toPath(BaseSource.attr(BaseSource.open(body), 'href'));
			if (!WeebcentralSource.CHAPTER_PATH.test(id) || seen.has(id)) continue;
			seen.add(id);
			const text = this.clean(BaseSource.text(BaseSource.inner(body, 'a')));
			const numMatch = text.match(/chapter\s*([\d.]+)/i);
			const number = numMatch ? parseFloat(numMatch[1]) : 0;
			// The row wrapper opens right before the anchor and holds the release time,
			// as <time datetime> or in its x-data checkNewChapter() call.
			const row = before.slice(before.lastIndexOf('</div>') + 6) + body;
			const date =
				this.clean(BaseSource.attr(BaseSource.tag(row, /<time[^>]*datetime=[^>]*>/i), 'datetime')) ||
				this.clean(row.match(/checkNewChapter\('([^']+)'\)/)?.[1] || '');
			chapters.push({ id, title: text || `Chapter ${number}`, number, date });
		}
		chapters.sort((a, b) => b.number - a.number);
		return chapters;
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		let path = this.toPath(mangaId);
		// A chapter path (/chapters/<ULID>) is not a series page. The chapter page
		// contains back-links to its series; resolve the first /series/<id>/<slug>.
		if (WeebcentralSource.CHAPTER_PATH.test(path)) {
			path = this.seriesPath(await this.fetchHtml(path)) || path;
		}
		const html = await this.fetchHtml(path);

		// Chapters: seed from an inline chapter link, then expand via chapter-select.
		const seed = html.match(/href="[^"]*\/chapters\/([^"/]+)"/i)?.[1] || '';
		const chapters = this.extractChapters(await this.fetchChapterList(path, seed));

		const h1 = BaseSource.records(html, /<h1\b/gi);
		const classy = h1.find((r) => {
			const classes = BaseSource.attr(BaseSource.open(r.body), 'class').split(/\s+/);
			return classes.includes('hidden') && classes.includes('md:block');
		});
		const title =
			this.clean(classy ? BaseSource.text(BaseSource.inner(classy.body, 'h1')) : '') ||
			this.clean(h1[0] ? BaseSource.text(BaseSource.inner(h1[0].body, 'h1')) : '') ||
			this.clean(
				BaseSource.attr(BaseSource.tag(html, /<meta[^>]*\bproperty="og:title"[^>]*>/i), 'content')
			) ||
			path;

		const cover = this.abs(
			BaseSource.attr(BaseSource.tag(html, /<meta[^>]*\bproperty="og:image"[^>]*>/i), 'content') ||
				BaseSource.tags(html, /<img\b[^>]*>/gi)
					.map((t) => BaseSource.attr(t, 'src'))
					.find((src) => src.includes('/cover/')) ||
				''
		);

		// Meta rows are <li><strong>Label(s): </strong> ...value...</li>
		const norm = (s: string) =>
			this.clean(s)
				.toLowerCase()
				.replace(/[^a-z]/g, '');
		const metaOf = (label: string): string => {
			const want = norm(label);
			for (const { body } of BaseSource.records(html, /<li\b/gi)) {
				const strong = BaseSource.tag(body, /<strong\b[^>]*>[\s\S]*?<\/strong>/i);
				if (norm(BaseSource.text(strong)).startsWith(want)) {
					return this.clean(BaseSource.text(BaseSource.inner(body, 'li').replace(strong, '')));
				}
			}
			return '';
		};

		const authors: string[] = [];
		for (const a of [metaOf('Author'), metaOf('Artist')]) {
			for (const part of a.split(/[,;]/)) {
				const n = this.clean(part);
				if (n && !authors.includes(n)) authors.push(n);
			}
		}

		const anchors = BaseSource.records(html, /<a\b/gi);
		const statusAnchor = anchors.find((r) =>
			BaseSource.attr(BaseSource.open(r.body), 'href').includes('included_status=')
		);
		const status =
			this.clean(
				statusAnchor ? BaseSource.text(BaseSource.inner(statusAnchor.body, 'a')) : ''
			) ||
			metaOf('Status') ||
			'Ongoing';

		const genres: string[] = [];
		for (const { body } of anchors) {
			if (!BaseSource.attr(BaseSource.open(body), 'href').includes('included_tag=')) continue;
			const g = this.clean(BaseSource.text(BaseSource.inner(body, 'a')));
			if (g && !genres.some((x) => x.toLowerCase() === g.toLowerCase())) genres.push(g);
		}

		const description = this.clean(
			BaseSource.text(
				BaseSource.tag(html, /<p\b[^>]*\bclass="[^"]*whitespace-pre-wrap[^"]*"[^>]*>[\s\S]*?<\/p>/i)
			)
		);

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

	/**
	 * Reader images: everything inside `#chapter-images`, plus any `/manga/` image
	 * earlier in the page (the second half of the old `#chapter-images img, img[src*="/manga/"]`).
	 */
	private pageImages(html: string): string[] {
		const at = html.search(/id="chapter-images"/i);
		const end = at < 0 ? -1 : html.indexOf('</section>', at);
		const head = at < 0 ? html : html.slice(0, at);
		const strip = at < 0 ? '' : html.slice(at, end < 0 ? html.length : end);

		const images: string[] = [];
		const push = (src: string) => {
			if (!src) return;
			const a = this.abs(src);
			if (!images.includes(a)) images.push(a);
		};
		for (const tag of BaseSource.tags(head, /<img\b[^>]*>/gi)) {
			const src = BaseSource.attr(tag, 'src');
			if (src.includes('/manga/')) push(src);
		}
		for (const tag of BaseSource.tags(strip, /<img\b[^>]*>/gi)) {
			push(BaseSource.attr(tag, 'src') || BaseSource.attr(tag, 'data-src'));
		}
		return images;
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const path = this.toPath(chapterId);
		const html = await this.fetchHtml(
			`${path}/images?is_prev=False&reading_style=long_strip&current_page=1`
		);
		return this.pageImages(html);
	}
}
