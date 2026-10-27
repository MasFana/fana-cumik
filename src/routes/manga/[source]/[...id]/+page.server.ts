/**
 * Manga Detail Page - Server Load Function
 *
 * Fetches full manga details including chapter list from the
 * appropriate source adapter. Implements edge caching for performance.
 */

import { getSource } from '$lib/server/sources';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	const { source, id } = params;

	// The [...id] catch-all gives us the full path, reconstruct with leading slash
	const mangaId = `/${id}`;

	try {
		const adapter = getSource(source);
		const manga = await adapter.getMangaDetails(mangaId);

		// Parse chapter titles to separate title from date for ALL chapters
		const parsedChapters = (manga.chapters || []).map(ch => {
			let title = ch.title || '';
			let date = ch.date || '';
			
			// If date field exists and title ends with date, remove date from title
			if (date && title.endsWith(date)) {
				title = title.slice(0, -date.length).trim();
			} else {
				// Fallback: regex parse
				const match = title.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i);
				if (match) {
					title = match[1].trim();
					date = match[2].trim() || date;
				}
			}
			return { ...ch, title, date };
		});

		const mangaWithParsedChapters = { ...manga, chapters: parsedChapters };

		// Caching Strategy:
		// - Browser cache: 10 minutes (max-age=600)
		// - CDN cache: 1 hour (s-maxage=3600)
		// - Stale-while-revalidate: 1 minute (serve stale while fetching fresh)
		setHeaders({
			'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=60'
		});

		return { manga: mangaWithParsedChapters, source };
	} catch (e) {
		console.error(`Failed to fetch manga ${mangaId} from ${source}:`, e);
		throw error(404, {
			message: 'Manga not found',
			...(e instanceof Error && { detail: e.message })
		});
	}
};
