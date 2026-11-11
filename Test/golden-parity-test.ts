/**
 * Field-by-field parity between the live adapters and the golden snapshots taken
 * from the cheerio implementation (Test/golden/*.json).
 *
 * Regenerate the snapshots with Test/golden-capture-test.ts before a parser change:
 *   esbuild Test/golden-capture-test.ts --bundle --platform=node --format=esm \
 *     --target=node20 --packages=external --outfile=tmp/golden.mjs && node tmp/golden.mjs
 *   esbuild Test/golden-parity-test.ts  ... --outfile=tmp/parity.mjs && node tmp/parity.mjs
 *
 * Live pages move on (new chapters, new covers), so a stale golden fails on purpose:
 * re-capture only after checking the difference is not a parser regression.
 */
import { readFile } from 'node:fs/promises';
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

/** Compare two values, pushing "path: got != want" lines, capped per section. */
function diff(got: unknown, want: unknown, path: string, out: string[]): void {
	if (out.length > 250) return;
	if (Array.isArray(got) || Array.isArray(want)) {
		if (!Array.isArray(got) || !Array.isArray(want)) {
			out.push(`${path}: not an array (got ${typeof got}, want ${typeof want})`);
			return;
		}
		if (got.length !== want.length) out.push(`${path}.length: ${got.length} != ${want.length}`);
		for (let i = 0; i < Math.min(got.length, want.length); i++) {
			diff(got[i], want[i], `${path}[${i}]`, out);
		}
		return;
	}
	if (got && want && typeof got === 'object' && typeof want === 'object') {
		for (const k of new Set([...Object.keys(got), ...Object.keys(want)])) {
			diff(
				(got as Record<string, unknown>)[k],
				(want as Record<string, unknown>)[k],
				`${path}.${k}`,
				out
			);
		}
		return;
	}
	if (got !== want) out.push(`${path}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
}

let failed = 0;
for (const t of targets) {
	const golden = JSON.parse(await readFile(`Test/golden/${t.source.id}.json`, 'utf8'));

	const live: Record<string, unknown> = {};
	const step = async (name: string, fn: () => Promise<unknown>) => {
		try {
			live[name] = await fn();
		} catch (e) {
			live[name] = { error: String(e) };
		}
	};
	await step('latest', () => t.source.getLatestManga(1));
	await step('search', () => t.source.searchManga(t.query));
	await step('details', () => t.source.getMangaDetails(t.mangaId));
	const details = live.details as { chapters?: { id: string }[] };
	const first = details?.chapters?.[0]?.id;
	if (first) await step('pages', () => t.source.getChapterPages(first));

	const problems: string[] = [];
	for (const k of Object.keys(golden)) diff(live[k], golden[k], k, problems);
	if (problems.length) {
		failed++;
		console.log(`\nFAIL ${t.source.id} (${problems.length} diffs, first 12)`);
		for (const p of problems.slice(0, 12)) console.log(`  ${p}`);
	} else {
		console.log(
			`PASS ${t.source.id}: latest=${(live.latest as unknown[]).length} search=${(live.search as unknown[]).length} chapters=${details.chapters?.length} pages=${(live.pages as unknown[]).length}`
		);
	}
}
console.log(failed ? `\n${failed} source(s) differ` : '\nall sources match golden');
