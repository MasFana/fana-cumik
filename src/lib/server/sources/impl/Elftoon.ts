import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';

interface ElfListItem {
	slug: string;
	title: string;
	coverImage?: string | null;
}

interface ElfListResponse {
	data?: ElfListItem[];
}

interface ElfSearchResponse {
	series?: ElfListItem[];
}

/**
 * Elf Toon Adapter (elftoon.net)
 * - Next.js App Router. Listing and search have JSON endpoints:
 *   `/api/series?page=N&sort=latest` (fixed 24 per page, `perPage` is ignored) and `/api/search?q=`.
 * - Series and reader pages are server-rendered. Description, chapter list and page
 *   images live in the RSC flight payload pushed to `self.__next_f`, so we decode those
 *   string literals instead of scraping the DOM. `/api/series?q=` is no substitute for
 *   details: it carries only the 3 newest chapters and no description.
 */
export class ElftoonSource extends BaseSource {
	id = 'elftoon';
	name = 'Elf Toon';
	baseUrl = 'https://elftoon.net';

	protected override headers: Record<string, string> = {
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
		Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
		'Accept-Language': 'en-US,en;q=0.5'
	};

	/** Decode the Next.js flight payload: every push argument is a JSON string literal. */
	private flight(html: string): string {
		let out = '';
		for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
			try {
				out += JSON.parse(m[1]);
			} catch {
				// A chunk we cannot decode is a chunk without data we read.
			}
		}
		return out;
	}

	/** Unescape a JSON string body captured by a regex. */
	private str(raw: string): string {
		try {
			return JSON.parse(`"${raw}"`);
		} catch {
			return raw;
		}
	}

	private abs(src: string): string {
		if (!src) return '';
		if (src.startsWith('http')) return src;
		return `${this.baseUrl}${src.startsWith('/') ? '' : '/'}${src}`;
	}

	/** Normalise any id/URL to the site path (`/series/comic/<slug>[/chapter/N]`). */
	private path(id: string): string {
		const p = (id.startsWith('http') ? new URL(id).pathname : id).split('?')[0];
		const clean = p.replace(/^\/+|\/+$/g, '');
		return clean.startsWith('series/') ? `/${clean}` : `/series/comic/${clean}`;
	}

	private toManga(item: ElfListItem): Manga {
		return {
			id: `/series/comic/${item.slug}`,
			title: item.title,
			cover: this.abs(item.coverImage || ''),
			sourceId: this.id
		};
	}

	/** Drop the prefix, then slice from the series object so field regexes stay in scope. */
	private seriesScope(flight: string): string {
		const i = flight.indexOf('"series":{');
		return i < 0 ? flight : flight.slice(i);
	}

	async getLatestManga(page: number): Promise<Manga[]> {
		const p = Number.isFinite(page) && page > 1 ? Math.floor(page) : 1;
		try {
			const data = await this.fetchJson<ElfListResponse>(`/api/series?page=${p}&sort=latest`);
			return (data.data || []).map((item) => this.toManga(item));
		} catch (e) {
			console.error('[ElfToon] getLatestManga failed:', e);
			return [];
		}
	}

	async searchManga(query: string): Promise<Manga[]> {
		try {
			const data = await this.fetchJson<ElfSearchResponse>(
				`/api/search?q=${encodeURIComponent(query)}`
			);
			return (data.series || []).map((item) => this.toManga(item));
		} catch (e) {
			console.error('[ElfToon] searchManga failed:', e);
			return [];
		}
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		const path = this.path(mangaId);
		const series = this.seriesScope(this.flight(await this.fetchHtml(path)));
		const field = (re: RegExp): string => this.str(series.match(re)?.[1] ?? '');

		const chapters: Chapter[] = [];
		const chRe =
			/"number":(\d+(?:\.\d+)?),"title":(?:null|"(?:[^"\\]|\\.)*")[^}]{0,400}?"publishedAt":"([^"]*)"/g;
		for (const m of series.matchAll(chRe)) {
			chapters.push({
				id: `${path}/chapter/${m[1]}`,
				title: `Chapter ${m[1]}`,
				number: parseFloat(m[1]),
				date: m[2]
			});
		}
		chapters.sort((a, b) => b.number - a.number);

		const genreBlock = series.match(/"genres":\[(.*?)\]/s)?.[1] ?? '';
		const genres: string[] = [];
		for (const g of genreBlock.matchAll(/"name":"((?:[^"\\]|\\.)*)"/g)) {
			const name = this.str(g[1]);
			if (name && !genres.includes(name)) genres.push(name);
		}

		const statusRaw = field(/"status":"([A-Z_]+)"/);
		const status = statusRaw
			? statusRaw.charAt(0) + statusRaw.slice(1).toLowerCase().replace(/_/g, ' ')
			: 'Ongoing';

		return {
			id: path,
			sourceId: this.id,
			title: field(/"title":"((?:[^"\\]|\\.)*)","slug":/),
			cover: this.abs(field(/"coverImage":"(\/uploads\/[^"]*)"/)),
			description: field(/"description":"((?:[^"\\]|\\.)*)"/),
			authors: [],
			status,
			genres,
			chapters
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const flight = this.flight(await this.fetchHtml(this.path(chapterId)));
		// Page images sit in the `pages` array; locked chapters carry empty imageUrl values.
		const i = flight.indexOf('"pages":[');
		const pages: string[] = [];
		for (const m of (i < 0 ? flight : flight.slice(i)).matchAll(/"imageUrl":"([^"]*)"/g)) {
			const url = this.abs(this.str(m[1]));
			if (url && !pages.includes(url)) pages.push(url);
		}
		return pages;
	}
}
