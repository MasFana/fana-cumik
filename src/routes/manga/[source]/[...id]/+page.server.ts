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

		// Caching Strategy:
		// - Browser cache: 10 minutes (max-age=600)
		// - CDN cache: 1 hour (s-maxage=3600)
		// - Stale-while-revalidate: 1 minute (serve stale while fetching fresh)
		setHeaders({
			'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=60'
		});

		return { manga, source };
	} catch (e) {
		console.error(`Failed to fetch manga ${mangaId} from ${source}:`, e);
		throw error(404, {
			message: 'Manga not found',
			...(e instanceof Error && { detail: e.message })
		});
	}
};
