import { getAllSources } from '../src/lib/server/sources';

const sources = getAllSources().filter((s) => !process.argv[2] || s.id === process.argv[2]);
console.log(`sources: ${sources.map((s) => s.id).join(', ')}\n`);

/** What kind of timestamp does the site put in the chapter list? */
const shape = (d: string): string => {
	if (!d) return 'none';
	if (/^\d{4}-\d{2}-\d{2}T/.test(d)) return 'iso';
	if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(d)) return 'd/m/y';
	if (/(ago|hours?|days?|minutes?|just now|yesterday)/i.test(d)) return 'relative';
	if (!isNaN(Date.parse(d))) return 'localized';
	return 'other';
};

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : 'n/a');

for (const s of sources) {
	const shapes: Record<string, number> = {};
	const samples: Record<string, string> = {};
	let series = 0;
	let chapters = 0;
	let mismatched = 0;
	try {
		for (const m of (await s.getLatestManga(1)).slice(0, 5)) {
			const d = await s.getMangaDetails(m.id);
			const ch = d.chapters || [];
			if (!ch.length) continue;
			series++;
			chapters += ch.length;
			for (const c of ch) {
				const k = shape(c.date);
				shapes[k] = (shapes[k] || 0) + 1;
				if (!samples[k]) samples[k] = c.date;
			}
			// Newest chapter first must mean time descending, compared as time when we can.
			const time = (x: string) => (shape(x) === 'iso' ? Date.parse(x) : 0);
			for (let i = 1; i < ch.length; i++) {
				const a = ch[i - 1];
				const b = ch[i];
				if (!a.date || !b.date) continue;
				if (time(a.date) && time(b.date) ? time(a.date) < time(b.date) : a.date < b.date)
					mismatched++;
			}
		}
	} catch (e) {
		console.log(`${s.id} ERROR ${(e as Error).message}`);
		continue;
	}
	if (!series) {
		console.log(`${s.id} no chapters parsed`);
		continue;
	}
	const parts = Object.entries(shapes)
		.sort((a, b) => b[1] - a[1])
		.map(
			([k, n]) =>
				`${k}=${n} (${pct(n, chapters)}) ${JSON.stringify(samples[k].replaceAll(':', '.'))}`
		);
	console.log(
		`${s.id} series=${series} chapters=${chapters} outOfOrder=${mismatched}\n    ${parts.join('\n    ')}`
	);
}
