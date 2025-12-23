/**
 * Core type definitions for the manga source adapter pattern.
 * All source adapters must implement the IMangaSource interface.
 */

export interface Manga {
	/** Unique identifier (usually the slug or URL path) */
	id: string;
	/** Display title of the manga */
	title: string;
	/** Cover image URL */
	cover: string;
	/** Source identifier (e.g., 'mangabat', 'asura') */
	sourceId: string;
}

export interface Chapter {
	/** Unique identifier (usually the URL path) */
	id: string;
	/** Chapter title (e.g., "Chapter 10") */
	title: string;
	/** Numeric chapter number for sorting */
	number: number;
	/** Release/upload date */
	date: string;
}

export interface MangaDetails extends Manga {
	/** Synopsis/description */
	description: string;
	/** List of authors */
	authors: string[];
	/** Publication status (e.g., "Ongoing", "Completed") */
	status: string;
	/** Genre tags */
	genres: string[];
	/** List of chapters, typically sorted newest first */
	chapters: Chapter[];
}

/**
 * Contract that all manga source adapters must implement.
 * The adapter pattern allows the UI to remain source-agnostic.
 */
export interface IMangaSource {
	/** Unique source identifier */
	id: string;
	/** Display name of the source */
	name: string;
	/** Base URL for the source website */
	baseUrl: string;

	/**
	 * Fetch popular/trending manga from the source.
	 * @param page - Page number for pagination (1-indexed)
	 */
	getLatestManga(page: number): Promise<Manga[]>;

	/**
	 * Search for manga by query string.
	 * @param query - Search term
	 */
	searchManga(query: string): Promise<Manga[]>;

	/**
	 * Fetch full manga details including chapter list.
	 * @param mangaId - Manga identifier (usually URL path)
	 */
	getMangaDetails(mangaId: string): Promise<MangaDetails>;

	/**
	 * Fetch all page image URLs for a chapter.
	 * @param chapterId - Chapter identifier (usually URL path)
	 * @returns Array of image URLs
	 */
	getChapterPages(chapterId: string): Promise<string[]>;
}
