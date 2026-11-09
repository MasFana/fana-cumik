/**
 * Reading History Store
 *
 * Tracks user's reading progress in localStorage.
 */

import { browser } from '$app/environment';

export interface ReadingEntry {
	mangaId: string;
	mangaSlug: string;
	mangaTitle: string;
	cover: string;
	chapterId: string;
	chapterTitle: string;
	chapterNumber: number;
	sourceId: string;
	timestamp: number;
	pageIndex?: number;
	totalPages?: number;
}

export interface ChapterProgress {
	pageIndex: number;
	scrollY: number;
	totalPages?: number;
	timestamp: number;
}

const STORAGE_KEY = 'fana-cumik_history';
const MAX_HISTORY = 50;
const PROGRESS_KEY_PREFIX = 'fana-cumik_prog_';

/**
 * Get all reading history entries
 */
export function getHistory(): ReadingEntry[] {
	if (!browser) return [];

	try {
		const data = localStorage.getItem(STORAGE_KEY);
		return data ? JSON.parse(data) : [];
	} catch {
		return [];
	}
}

/**
 * Save a reading entry (updates if manga already exists)
 */
export function saveReading(entry: Omit<ReadingEntry, 'timestamp'>): void {
	if (!browser) return;

	try {
		const history = getHistory();

		// Remove existing entry for this manga if present
		const filtered = history.filter((h) => h.mangaId !== entry.mangaId);

		// Add new entry at the beginning
		const newEntry: ReadingEntry = {
			...entry,
			timestamp: Date.now()
		};

		filtered.unshift(newEntry);

		// Limit history size
		const trimmed = filtered.slice(0, MAX_HISTORY);

		localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
	} catch {
		// Silent fail
	}
}

/**
 * Get last read chapter for a specific manga
 */
export function getLastRead(mangaId: string): ReadingEntry | null {
	const history = getHistory();
	return history.find((h) => h.mangaId === mangaId) || null;
}

/**
 * Clear all reading history
 */
export function clearHistory(): void {
	if (!browser) return;
	localStorage.removeItem(STORAGE_KEY);
}

/**
 * Remove a specific entry from history
 */
export function removeFromHistory(mangaId: string): void {
	if (!browser) return;

	const history = getHistory();
	const filtered = history.filter((h) => h.mangaId !== mangaId);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Save chapter specific progress (page index and scroll position)
 */
export function saveChapterProgress(sourceId: string, chapterId: string, progress: Omit<ChapterProgress, 'timestamp'>): void {
	if (!browser) return;
	try {
		const key = `${PROGRESS_KEY_PREFIX}${sourceId}_${chapterId}`;
		const data: ChapterProgress = {
			...progress,
			timestamp: Date.now()
		};
		localStorage.setItem(key, JSON.stringify(data));
	} catch {
		// Silent fail
	}
}

/**
 * Get saved chapter progress
 */
export function getChapterProgress(sourceId: string, chapterId: string): ChapterProgress | null {
	if (!browser) return null;
	try {
		const key = `${PROGRESS_KEY_PREFIX}${sourceId}_${chapterId}`;
		const data = localStorage.getItem(key);
		return data ? JSON.parse(data) : null;
	} catch {
		return null;
	}
}

/**
 * Clear saved chapter progress
 */
export function clearChapterProgress(sourceId: string, chapterId: string): void {
	if (!browser) return;
	try {
		const key = `${PROGRESS_KEY_PREFIX}${sourceId}_${chapterId}`;
		localStorage.removeItem(key);
	} catch {
		// Silent fail
	}
}
