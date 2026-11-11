import { ElftoonSource } from '../src/lib/server/sources/impl/Elftoon';

const s = new ElftoonSource();
let fail = 0;
const ok = (cond: boolean, msg: string) => {
	console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`);
	if (!cond) fail++;
};

// 1. latest — /api/series?page=N&sort=latest (fixed 24 per page)
const l1 = await s.getLatestManga(1);
const l2 = await s.getLatestManga(2);
ok(l1.length > 5, `getLatestManga(1) -> ${l1.length} cards`);
ok(l2.length > 5, `getLatestManga(2) -> ${l2.length} cards`);
const l1ids = new Set(l1.map((m) => m.id));
ok(!l2.some((m) => l1ids.has(m.id)), 'latest page1/page2 disjoint');
ok(
	l1.every((m) => /^\/series\/comic\/[^/]+$/.test(m.id)),
	'latest ids are /series/comic/<slug>'
);
ok(
	l1.every((m) => m.cover.startsWith('https://elftoon.net/uploads/')),
	'latest covers absolute'
);

// 2. search — /api/search?q=
const q = 'butcher';
const found = await s.searchManga(q);
ok(found.length > 0, `searchManga(${q}) -> ${found.length} cards`);
ok(
	found.some((m) => m.title.toLowerCase().includes(q)),
	`search(${q}) returns a title match`
);
ok((await s.searchManga('zzzznope')).length === 0, 'no-hit search -> empty');

// 3. details — flight payload of the series page
const hit = found[0];
const d = await s.getMangaDetails(hit.id);
ok(d.title === hit.title, `details title: ${d.title}`);
ok(d.cover.startsWith('https://elftoon.net/uploads/'), `details cover: ${d.cover.slice(0, 60)}`);
ok(d.description.length > 40, `details desc len: ${d.description.length}`);
ok(d.genres.length > 0, `details genres: ${d.genres.join(', ')}`);
ok(d.chapters.length > 20, `details chapters: ${d.chapters.length}`);
ok(
	d.chapters.every((c) => c.id.startsWith(`${hit.id}/chapter/`)),
	'chapter ids are <series path>/chapter/<n>'
);
ok(
	d.chapters.every((c, i, a) => i === 0 || a[i - 1].number >= c.number),
	'chapters sorted desc'
);
ok(
	d.chapters.every((c) => c.date === '' || !isNaN(Date.parse(c.date))),
	'chapter dates parseable'
);

// 4. reader pages — flight payload of the chapter page
const free = d.chapters[d.chapters.length - 1];
const pages = await s.getChapterPages(free.id);
ok(pages.length > 3, `getChapterPages(${free.id}) -> ${pages.length} pages`);
ok(
	pages.every((p) => p.startsWith('https://elftoon.net/uploads/')),
	'page urls absolute'
);
ok(
	pages.every((p, i, a) => i === 0 || a[i - 1] !== p),
	'page urls unique'
);
ok(
	pages.every((p) => /p\d{4}-/.test(p)),
	'page urls keep their order suffix'
);

// 5. locked chapter -> no pages, no throw
const locked = await s.getChapterPages(`${hit.id}/chapter/99`);
ok(locked.length === 0, 'missing chapter -> empty page list');

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
