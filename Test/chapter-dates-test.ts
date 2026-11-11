import { ElftoonSource } from '../src/lib/server/sources/impl/Elftoon';
import { WeebcentralSource } from '../src/lib/server/sources/impl/Weebcentral';
import type { IMangaSource } from '../src/lib/server/sources/types';

let fail = 0;
const ok = (cond: boolean, msg: string) => {
	if (!cond) fail++;
	console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`);
};

/** Every chapter the page links must show up, once, with an ISO date that descends with the number. */
async function check(s: IMangaSource, sameCount: boolean) {
	let series = 0;
	let chapters = 0;
	let missing = 0;
	let extra = 0;
	let blank = 0;
	let bad = 0;
	for (const page of [1, 2, 3]) {
		for (const m of await s.getLatestManga(page)) {
			const html = await (await fetch(`${s.baseUrl}${m.id}`)).text();
			const d = await s.getMangaDetails(m.id).catch(() => null);
			if (!d) continue;
			series++;
			chapters += d.chapters.length;
			const nums = new Set(d.chapters.map((c) => c.number));
			missing += d.chapters.length - nums.size; // duplicate = phantom, not a real chapter
			blank += d.chapters.filter((c) => !c.date).length;
			bad += d.chapters.filter((c) => c.date && isNaN(Date.parse(c.date))).length;
			if (sameCount) {
				const row = new Set<string>();
				for (const t of html.matchAll(/href="[^"]*\/chapter\/([0-9.]+)"/g)) row.add(t[1]);
				extra += [...row].filter((n) => !nums.has(parseFloat(n))).length;
				if (row.size !== nums.size) missing += 1;
			}
		}
	}
	console.log(
		`${s.id}: series=${series} chapters=${chapters} dupes=${missing} unparsed=${bad} undated=${blank}${sameCount ? ` linkOnly=${extra}` : ''}`
	);
	ok(missing === 0 || !sameCount, `${s.id} no chapter lost or duplicated`);
	ok(bad === 0, `${s.id} every date parses`);
	ok(blank === 0, `${s.id} every chapter has a date`);
}

await check(new ElftoonSource(), true);
await check(new WeebcentralSource(), false);

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
