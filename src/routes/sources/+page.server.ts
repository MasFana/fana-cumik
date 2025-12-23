/**
 * Sources Page - List all available manga sources
 */

import { getAllSources } from '$lib/server/sources';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	const sources = getAllSources();

	setHeaders({
		'Cache-Control': 'public, max-age=3600'
	});

	return {
		sources: sources.map((s) => ({
			id: s.id,
			name: s.name,
			baseUrl: s.baseUrl
		}))
	};
};
