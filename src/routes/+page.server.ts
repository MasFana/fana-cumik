/**
 * Home Page - Server Load Function
 *
 * Fetches popular manga from the default source.
 */

import { getAllSources, getSource } from '$lib/server/sources';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, setHeaders }) => {
	// Get source from URL params, fallback to asura if none specified
	// Client-side will handle redirecting to stored impl if needed
	const sourceId = url.searchParams.get('source') || 'asura';
	const page = parseInt(url.searchParams.get('page') || '1');
	const query = url.searchParams.get('q') || '';

	try {
		const adapter = getSource(sourceId);
		const sources = getAllSources();

		// Fetch manga based on search or popular
		const mangas = query ? await adapter.searchManga(query) : await adapter.getLatestManga(page);

		// Cache popular listings for 30 minutes
		setHeaders({
			'Cache-Control': query
				? 'public, max-age=60, s-maxage=300'
				: 'public, max-age=300, s-maxage=1800'
		});

		return {
			mangas,
			sources: sources.map((s) => ({ id: s.id, name: s.name })),
			currentSource: sourceId,
			currentPage: page,
			searchQuery: query
		};
	} catch (e) {
		console.error('Failed to load manga:', e);
		throw error(500, { message: 'Failed to load manga' });
	}
};
