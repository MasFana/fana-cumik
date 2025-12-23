import type { IMangaSource, Manga, MangaDetails } from './types';

/**
 * Abstract base class for all manga source adapters.
 * Provides shared functionality like HTTP fetching with proper headers.
 */
export abstract class BaseSource implements IMangaSource {
	abstract id: string;
	abstract name: string;
	abstract baseUrl: string;

	/**
	 * Default headers to avoid bot detection.
	 * Most manga sites block requests without a proper User-Agent.
	 */
	protected headers: Record<string, string> = {
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'Accept-Language': 'en-US,en;q=0.5'
	};

	/**
	 * Fetch HTML content from the source with proper headers.
	 * @param path - URL path to append to baseUrl
	 * @returns HTML string
	 */
	protected async fetchHtml(path: string): Promise<string> {
		const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

		const response = await fetch(url, {
			headers: {
				...this.headers,
				Referer: this.baseUrl
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
		}

		return await response.text();
	}

	/**
	 * Fetch JSON data from the source (for sites with API endpoints).
	 * @param path - URL path to append to baseUrl
	 * @returns Parsed JSON
	 */
	protected async fetchJson<T>(path: string): Promise<T> {
		const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

		const response = await fetch(url, {
			headers: {
				...this.headers,
				Referer: this.baseUrl,
				Accept: 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
		}

		return await response.json();
	}

	// Abstract methods to be implemented by concrete adapters
	abstract getLatestManga(page: number): Promise<Manga[]>;
	abstract searchManga(query: string): Promise<Manga[]>;
	abstract getMangaDetails(mangaId: string): Promise<MangaDetails>;
	abstract getChapterPages(chapterId: string): Promise<string[]>;
}
