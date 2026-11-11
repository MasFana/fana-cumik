/**
 * Snapshot every adapter's output to Test/golden/<id>.json, so a parser rewrite
 * can be checked field by field against the cheerio version.
 *
 * Regenerate: node tmp/golden.mjs capture  (see golden-parity-test.ts header)
 * The pages are live, so a golden file goes stale as sites publish chapters.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { AsuraSource } from '../src/lib/server/sources/impl/Asura';
import { KomikuSource } from '../src/lib/server/sources/impl/Komiku';
import { VortexSource } from '../src/lib/server/sources/impl/Vortex';
import { WeebcentralSource } from '../src/lib/server/sources/impl/Weebcentral';
import type { BaseSource } from '../src/lib/server/sources/BaseSource';

const targets: { source: BaseSource; mangaId: string; query: string }[] = [
	{
		source: new WeebcentralSource(),
		mangaId: '/series/01J76XYD3Q2Q7HYYMB3FSDPSKC/Eleceed',
		query: 'eleceed'
	},
	{
		source: new KomikuSource(),
		mangaId: '/manga/chronicles-of-the-demon-slaying-cultivator',
		query: 'cultivator'
	},
	{
		source: new AsuraSource(),
		mangaId: '/comics/cyberpunk-chivalry-f212c582',
		query: 'cyberpunk'
	},
	{
		source: new VortexSource(),
		mangaId: "/series/the-hero's-ballad",
		query: 'hero'
	}
];

await mkdir('Test/golden', { recursive: true });
for (const t of targets) {
	const out: Record<string, unknown> = {};
	const step = async (name: string, fn: () => Promise<unknown>) => {
		try {
			out[name] = await fn();
		} catch (e) {
			out[name] = { error: String(e) };
		}
		const v = out[name];
		const n = Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0;
		console.log(`${t.source.id}.${name}: ${n ?? 0}`);
	};

	await step('latest', () => t.source.getLatestManga(1));
	await step('search', () => t.source.searchManga(t.query));
	await step('details', () => t.source.getMangaDetails(t.mangaId));
	const details = out.details as { chapters?: { id: string }[] } | undefined;
	const first = details && !('error' in details) ? details.chapters?.[0]?.id : undefined;
	if (first) await step('pages', () => t.source.getChapterPages(first));

	await writeFile(`Test/golden/${t.source.id}.json`, JSON.stringify(out, null, '\t') + '\n');
}
