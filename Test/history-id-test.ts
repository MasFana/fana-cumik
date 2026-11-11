/**
 * History entries store `mangaInfo.id` from the reader. Opening that id as
 * /manga/<source><id> must show the chapter list, so this test replays what the
 * reader stores and re-reads it.
 *
 * Usage: node x.mjs [sourceId]      (set BASE= to also check the live app)
 */
import { getAllSources } from '../src/lib/server/sources';

const base = process.env.BASE || 'https://fana-cumik.fanaapi425.workers.dev';

/** Same strip the reader route does, to get the manga id it stores for history. */
const strip = (chapterId: string) =>
	chapterId.replace(/^([\s\S]*)\/(?:chapter|ch|episode|ep)s?[-/_][\s\S]*$/i, '$1');

let fail = 0;
const ok = (cond: boolean, msg: string) => {
	if (!cond) fail++;
	console.log(`${cond ? 'PASS' : 'FAIL'} ${msg}`);
};

for (const s of getAllSources()) {
	if (process.argv[2] && s.id !== process.argv[2]) continue;
	const list = await s.getLatestManga(1);
	const d = await s.getMangaDetails(list[0].id);
	const chapterId = d.chapters[0]?.id || '';
	const mangaId = strip(chapterId) || chapterId;

	// An id that does not start with "/" is glued onto the source in the history link.
	ok(d.id.startsWith('/'), `${s.id} chapter list id starts with "/" (${d.id})`);

	try {
		const back = await s.getMangaDetails(mangaId);
		ok(
			back.chapters.length > 0,
			`${s.id} reopens from history id (${back.chapters.length} chapters)`
		);
		ok(back.id === d.id, `${s.id} reopens on the same manga (${back.id})`);
	} catch (e) {
		ok(false, `${s.id} reopens from history id: ${(e as Error).message}`);
	}

	if (base) {
		const html = await (await fetch(`${base}/manga/${s.id}${d.id}`)).text();
		const links = new Set([...html.matchAll(/href="\/read\/[^"]+"/g)].map((m) => m[0]));
		ok(links.size > 0, `${s.id} live page lists chapters (${links.size} links)`);
	}
}

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
