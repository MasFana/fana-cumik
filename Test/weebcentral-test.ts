import { WeebcentralSource } from '../src/lib/server/sources/impl/Weebcentral';

const s = new WeebcentralSource();
let fail = 0;
const ok = (cond: boolean, msg: string) => {
	console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`);
	if (!cond) fail++;
};

// 1. latest — paginated via /latest-updates/<n>
const l1 = await s.getLatestManga(1);
const l2 = await s.getLatestManga(2);
ok(l1.length > 5, `getLatestManga(1) -> ${l1.length} cards`);
ok(l2.length > 5, `getLatestManga(2) -> ${l2.length} cards`);
const l1ids = new Set(l1.map((m) => m.id));
ok(!l2.some((m) => l1ids.has(m.id)), 'latest page1/page2 disjoint');
ok(l1.every((m) => /^\/series\/[^/]+\/[^/]+$/.test(m.id)), 'latest ids are /series/<id>/<slug>');
ok(l1.every((m) => m.cover.startsWith('http')), 'latest covers absolute');

// 2. search — paginated via limit=32&offset
const q = 'solo';
const p1 = await s.searchManga(q, 1);
const p2 = await s.searchManga(q, 2);
ok(p1.length > 0, `searchManga(${q},1) -> ${p1.length} cards`);
const p1ids = new Set(p1.map((m) => m.id));
ok(!p2.some((m) => p1ids.has(m.id)), `search ${q} page1/page2 disjoint`);
ok(p1.length <= 32, `search page size capped at 32 (got ${p1.length})`);
const narrow = await s.searchManga('solo leveling ragnarok', 2);
ok(narrow.length === 0, 'exhausted search page -> empty (termination)');

// 3. details
const hit = p1.find((m) => /solo-leveling/i.test(m.id)) || p1[0];
const d = await s.getMangaDetails(hit.id);
ok(d.title.length > 0, `details title: ${d.title}`);
ok(d.cover.startsWith('http'), `details cover: ${d.cover.slice(0, 60)}`);
ok(d.description.length > 10, `details desc len: ${d.description.length}`);
ok(d.chapters.length > 50, `details chapters: ${d.chapters.length}`);
ok(d.chapters.every((c) => c.id.startsWith('/chapters/')), 'chapter ids /chapters/<id>');
ok(d.chapters.every((c, i, a) => i === 0 || a[i - 1].number >= c.number), 'chapters sorted desc');

// 4. pages
const pages = await s.getChapterPages(d.chapters[0].id);
ok(pages.length > 0, `getChapterPages -> ${pages.length} images`);
ok(pages.every((p) => p.startsWith('http')), 'page urls absolute');

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
