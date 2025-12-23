/**
 * Source Registry - Central factory for all manga source adapters.
 *
 * To add a new source:
 * 1. Create a new adapter in ./impl/ that extends BaseSource
 * 2. Import and register it in the `sources` record below
 */

import { AsuraSource } from './impl/Asura';
import type { IMangaSource } from './types';

// Registry of all available manga sources
const sources: Record<string, IMangaSource> = {
	asura: new AsuraSource()
	// Add more sources here:
	// mangabat: new MangabatSource(),
	// komikcast: new KomikcastSource(),
};

/**
 * Get a specific source adapter by ID.
 * @throws Error if source not found
 */
export function getSource(sourceId: string): IMangaSource {
	const source = sources[sourceId];
	if (!source) {
		throw new Error(`Source "${sourceId}" not found. Available sources: ${Object.keys(sources).join(', ')}`);
	}
	return source;
}

/**
 * Get all available source adapters.
 */
export function getAllSources(): IMangaSource[] {
	return Object.values(sources);
}

/**
 * Get source metadata for display.
 */
export function getSourceList(): Array<{ id: string; name: string }> {
	return Object.values(sources).map((s) => ({
		id: s.id,
		name: s.name
	}));
}
