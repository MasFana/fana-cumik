import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';

/**
 * Komiku Adapter (komiku.org)
 * Indonesian manga/manhwa/manhua site.
 * - Latest updates & Search: fetched via api.komiku.org HTML endpoints.
 * - Manga details: fetched from komiku.org/manga/{slug}/.
 * - Chapter pages: resolved via api.komiku.org wp-json post slug lookup,
 *   then loaded from komiku.org/?p={postId} to bypass CF chapter challenge.
 *
 * Parsing is regex over the raw HTML (no DOM): every list here is a flat run of
 * records, so one pass per record beats building a tree. See BaseSource.
 */
export class KomikuSource extends BaseSource {
	id = 'komiku';
	name = 'Komiku';
	baseUrl = 'https://komiku.org';

	/** Reader containers, in the order the old combined selector listed them. */
	private static readonly READERS = [
		/id="Baca_Komik"/i,
		/class="[^"]*\bbaca-area\b[^"]*"/i,
		/class="[^"]*\bchapter-content\b[^"]*"/i,
		/id="chapter-images"/i
	];

	private normalizeLink(link: string): string {
		if (link.startsWith('http')) {
			const url = new URL(link);
			return url.pathname + (url.pathname.endsWith('/') ? '' : '/');
		}
		return link.startsWith('/') ? link : `/${link}`;
	}

	/** Komiku's listing serves a 450x235 landscape banner; the card grid is 2:3
	 *  portrait and stretches it, so ask the resize proxy for a portrait crop. */
	private coverUrl(raw: string): string {
		if (!raw) return '';
		const abs = raw.startsWith('http') ? raw : `https:${raw}`;
		try {
			const u = new URL(abs);
			if (u.hostname.includes('komiku') && !/\.(gif|svg)$/i.test(u.pathname)) {
				u.searchParams.set('resize', '450,675');
			}
			return u.toString();
		} catch {
			return abs;
		}
	}

	/** The element around the first match of `marker`, or '' when absent. */
	private region(html: string, marker: RegExp): string {
		const at = html.search(marker);
		return at < 0 ? '' : BaseSource.elementAt(html, at);
	}

	private firstImg(html: string): string {
		const tag = BaseSource.tag(html, /<img\b[^>]*>/i);
		return BaseSource.attr(tag, 'data-src') || BaseSource.attr(tag, 'src');
	}

	/** Cards of api.komiku.org: one `.bge` block per manga (image anchor, `h3` title). */
	private cards(html: string): Manga[] {
		const res: Manga[] = [];
		for (const { body } of BaseSource.records(
			html,
			/<div[^>]*\bclass="[^"]*\bbge\b[^"]*"[^>]*>/gi
		)) {
			const link = BaseSource.attr(BaseSource.tag(body, /<a\b[^>]*>/i), 'href');
			const image = this.firstImg(body);
			const title =
				BaseSource.text(BaseSource.tag(body, /<h3\b[^>]*>[\s\S]*?<\/h3>/i)) ||
				BaseSource.text(BaseSource.tag(body, /<h4\b[^>]*>[\s\S]*?<\/h4>/i));

			if (title && link) {
				res.push({
					id: this.normalizeLink(link),
					title,
					cover: this.coverUrl(image),
					sourceId: this.id
				});
			}
		}
		return res;
	}

	/** Fallback listing (komiku.org/daftar-komik): `.manga-card` blocks, title in the `h4` link. */
	private daftarCards(html: string): Manga[] {
		const res: Manga[] = [];
		for (const { body } of BaseSource.records(
			html,
			/<div[^>]*\bclass="[^"]*\bmanga-card\b[^"]*"[^>]*>/gi
		)) {
			const h4 = BaseSource.tag(body, /<h4\b[^>]*>[\s\S]*?<\/h4>/i);
			const link = BaseSource.attr(BaseSource.tag(h4, /<a\b[^>]*>/i), 'href');
			const title = BaseSource.text(h4);

			if (title && link) {
				res.push({
					id: this.normalizeLink(link),
					title,
					cover: this.coverUrl(this.firstImg(body)),
					sourceId: this.id
				});
			}
		}
		return res;
	}

	async getLatestManga(page: number): Promise<Manga[]> {
		try {
			// Fetch true latest updates via api.komiku.org
			const url =
				page === 1
					? 'https://api.komiku.org/manga/?orderby=modified'
					: `https://api.komiku.org/manga/page/${page}/?orderby=modified`;

			const res = this.cards(await this.fetchHtml(url));
			if (res.length > 0) return res;

			// Fallback to alphabetical listing from main site if API returns empty
			const fallbackUrl =
				page === 1 ? `${this.baseUrl}/daftar-komik/` : `${this.baseUrl}/daftar-komik/page/${page}/`;
			return this.daftarCards(await this.fetchHtml(fallbackUrl));
		} catch (e) {
			console.error('[Komiku] getLatestManga failed:', e);
			return [];
		}
	}

	async searchManga(query: string, page = 1): Promise<Manga[]> {
		try {
			const url =
				page > 1
					? `https://api.komiku.org/manga/page/${page}/?s=${encodeURIComponent(query)}&post_type=manga`
					: `https://api.komiku.org/manga/?s=${encodeURIComponent(query)}&post_type=manga`;
			return this.cards(await this.fetchHtml(url));
		} catch (e) {
			console.error('[Komiku] searchManga failed:', e);
			return [];
		}
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		let normalizedId = mangaId;
		if (!normalizedId.startsWith('/manga/')) {
			normalizedId = `/manga${normalizedId.startsWith('/') ? normalizedId : '/' + normalizedId}`;
		}
		if (!normalizedId.endsWith('/')) {
			normalizedId += '/';
		}

		const html = await this.fetchHtml(normalizedId);

		const h1 = BaseSource.tag(this.region(html, /id="Judul"/i), /<h1\b[^>]*>[\s\S]*?<\/h1>/i);
		const title = BaseSource.text(h1).replace(/^Komik\s+/i, '');
		const cover = BaseSource.attr(
			BaseSource.tag(this.region(html, /id="Informasi"/i), /<img\b[^>]*>/i),
			'src'
		);
		const description = BaseSource.text(
			BaseSource.tag(html, /<([a-z]+)\b[^>]*\bclass="[^"]*\bdesc\b[^"]*"[^>]*>[\s\S]*?<\/\1>/i)
		);

		const genres: string[] = [];
		const genreList = BaseSource.tag(
			html,
			/<ul\b[^>]*\bclass="[^"]*\bgenre\b[^"]*"[^>]*>[\s\S]*?<\/ul>/i
		);
		for (const span of BaseSource.tags(genreList, /<span\b[^>]*>[\s\S]*?<\/span>/gi)) {
			const g = BaseSource.text(span);
			if (g) genres.push(g);
		}

		let author = '';
		let status = 'Ongoing';
		const info = BaseSource.tag(
			html,
			/<table\b[^>]*\bclass="[^"]*\binftable\b[^"]*"[^>]*>[\s\S]*?<\/table>/i
		);
		for (const { body } of BaseSource.records(info, /<tr\b/gi)) {
			const cells = BaseSource.tags(body, /<td\b[^>]*>[\s\S]*?<\/td>/gi);
			if (!cells.length) continue;
			const label = BaseSource.text(cells[0]);
			const value = BaseSource.text(cells[cells.length - 1]);
			if (label.includes('Author') || label.includes('Penulis') || label.includes('Pengarang')) {
				author = value;
			}
			if (label.includes('Status')) status = value;
		}

		const mangaSlug = normalizedId.replace(/^\/manga\/|\/+$/g, '');
		const chapters: Chapter[] = [];
		const table = BaseSource.tag(
			html,
			/<table\b[^>]*\bid="Daftar_Chapter"[^>]*>[\s\S]*?<\/table>/i
		);
		for (const { body } of BaseSource.records(table, /<tr\b/gi)) {
			// The old selector took rows with a link, plus rows marked as list items.
			if (!/<a\b/i.test(body) && !/itemprop="itemListElement"/i.test(body)) continue;

			const link =
				BaseSource.attr(BaseSource.tag(body, /<a\b[^>]*\bitemprop="url"[^>]*>/i), 'href') ||
				BaseSource.attr(BaseSource.tag(body, /<a\b[^>]*>/i), 'href');
			const chapterTitle =
				BaseSource.text(BaseSource.element(body, 'itemprop', 'name')) ||
				BaseSource.text(BaseSource.tag(body, /<a\b[^>]*>[\s\S]*?<\/a>/i));
			if (!link) continue;

			const numMatch =
				chapterTitle.match(/chapter\s*(\d+(?:\.\d+)?)/i) || link.match(/-chapter-(\d+(?:\.\d+)?)/i);
			const number = numMatch ? parseFloat(numMatch[1]) : 0;
			const chSlug = link.replace(/^\/+|\/+$/g, '');
			const dateRow = BaseSource.tag(
				body,
				/<[a-z]+\b[^>]*\bclass="[^"]*\btanggalseries\b[^"]*"[^>]*>[\s\S]*?<\/[a-z]+>/i
			);

			chapters.push({
				id: `/manga/${mangaSlug}/chapter/${chSlug}`,
				title: chapterTitle || `Chapter ${number}`,
				number,
				date: BaseSource.text(dateRow)
			});
		}

		chapters.sort((a, b) => b.number - a.number);

		return {
			id: normalizedId,
			sourceId: this.id,
			title: title || normalizedId,
			cover: cover.startsWith('http') ? cover : cover ? `https:${cover}` : '',
			description: description || '',
			authors: author ? [author] : [],
			status,
			genres,
			chapters
		};
	}

	/** Chapter images from a reader region, minus ads (the old selector's filter). */
	private readerImages(region: string): string[] {
		const images: string[] = [];
		for (const tag of BaseSource.tags(region, /<img\b[^>]*>/gi)) {
			const src = BaseSource.attr(tag, 'src') || BaseSource.attr(tag, 'data-src');
			if (src && !src.includes('komiku-promosi') && !src.endsWith('.gif')) {
				images.push(src.startsWith('http') ? src : `https:${src}`);
			}
		}
		return images;
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const segments = chapterId.split('/').filter(Boolean);
		const clean = segments.at(-1) || chapterId.replace(/^\/+|\/+$/g, '');

		let postId: string | number | null = null;

		if (/^\d+$/.test(clean)) {
			postId = clean;
		} else if (clean.startsWith('?p=')) {
			postId = clean.slice(3);
		} else {
			try {
				const posts = await this.fetchJson<Array<{ id: number }>>(
					`https://api.komiku.org/wp-json/wp/v2/posts?slug=${encodeURIComponent(clean)}`
				);
				if (posts && posts.length > 0) {
					postId = posts[0].id;
				}
			} catch (e) {
				console.warn('[Komiku] Failed to resolve slug via wp-json:', e);
			}
		}

		const html = postId
			? await this.fetchHtml(`/?p=${postId}`)
			: await this.fetchHtml(`/${clean}/`);

		// First reader container that holds anything; the others are alternatives.
		for (const marker of KomikuSource.READERS) {
			const images = this.readerImages(this.region(html, marker));
			if (images.length) return images;
		}

		// Fallback: the page's own images, from the outermost of the old selectors.
		const starts = [
			html.search(/id="main"/i),
			html.search(/<article\b/i),
			html.search(/class="[^"]*\bperapih\b[^"]*"/i)
		]
			.filter((i) => i >= 0)
			.sort((a, b) => a - b);
		return starts.length ? this.readerImages(BaseSource.elementAt(html, starts[0])) : [];
	}
}
