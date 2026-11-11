/**
 * cheerio (tree build + CSS selectors) vs pure regex extraction, on real pages.
 * Measures only the parse+extract step: the HTML is fetched once and cached in
 * tmp/bench, so the numbers are CPU work, not network.
 *
 * Usage: node x.mjs [runs]
 */
import * as cheerio from 'cheerio';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { AsuraSource } from '../src/lib/server/sources/impl/Asura';
import { KomikuSource } from '../src/lib/server/sources/impl/Komiku';
import { VortexSource } from '../src/lib/server/sources/impl/Vortex';
import { WeebcentralSource } from '../src/lib/server/sources/impl/Weebcentral';

const runs = Number(process.argv[2] || 7);
const DIR = 'tmp/bench';

async function cached(
	name: string,
	path: string,
	s: { fetchHtml: (p: string) => Promise<string> }
) {
	const file = `${DIR}/${name}.html`;
	if (existsSync(file)) return readFile(file, 'utf8');
	const html = await s.fetchHtml(path);
	await mkdir(DIR, { recursive: true });
	await writeFile(file, html);
	return html;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
function time(fn: () => unknown) {
	const out: number[] = [];
	for (let i = 0; i < runs; i++) {
		const t = performance.now();
		fn();
		out.push(performance.now() - t);
	}
	return median(out);
}

const uniq = (ids: string[]) => [...new Set(ids)];

/** parse+extract with cheerio vs the same list with regex */
type Case = {
	name: string;
	source: unknown;
	path: string; // series page
	listPath?: string;
	cheerio: (html: string) => string[];
	regex: (html: string) => string[];
	regexLabel: string;
};

const cases: Case[] = [
	{
		name: 'weebcentral',
		source: new WeebcentralSource(),
		path: '/series/01J76XYD3Q2Q7HYYMB3FSDPSKC/Eleceed',
		// the site's /full-chapter-list intermittently 404s; the adapter falls back
		cheerio: (html) => {
			const $ = cheerio.load(html);
			const ids: string[] = [];
			$('a[href*="/chapters/"]').each((_, el) => {
				const id = $(el).attr('href') || '';
				if (/^\/chapters\/[^/]+$/.test(id)) ids.push(id);
			});
			return uniq(ids);
		},
		regex: (html) =>
			uniq(
				Array.from(html.matchAll(/<a[^>]*href="([^"]*\/chapters\/[^"/]+)"[^>]*>/gi), (m) =>
					m[1].startsWith('/') ? m[1] : `/${m[1]}`
				)
			),
		regexLabel: 'one-pass anchor scan'
	},
	{
		name: 'komiku',
		source: new KomikuSource(),
		path: '/manga/chronicles-of-the-demon-slaying-cultivator/',
		cheerio: (html) => {
			const $ = cheerio.load(html);
			const ids: string[] = [];
			// The site's own selector: :has() walks every <tr> subtree.
			$('#Daftar_Chapter tr:has(a), #daftarChapter tr[itemprop="itemListElement"]').each(
				(_, el) => {
					const href = $(el).find('a').first().attr('href') || '';
					if (href) ids.push(href);
				}
			);
			return uniq(ids);
		},
		// Split on the row marker instead of walking a tree: every later row starts
		// with the same tag, so each chunk holds exactly one chapter.
		regex: (html) =>
			uniq(
				html
					.split(/<tr[^>]*itemprop="itemListElement"[^>]*>/i)
					.slice(1)
					.map((row) => row.match(/href="([^"]+)"/i)?.[1] || '')
					.filter(Boolean)
			),
		regexLabel: 'row split, then anchor'
	},
	{
		name: 'asura',
		source: new AsuraSource(),
		path: '/comics/cyberpunk-chivalry-f212c582',
		cheerio: (html) => {
			const $ = cheerio.load(html);
			const slug = 'cyberpunk-chivalry-f212c582';
			const ids: string[] = [];
			$(`a[href^="/comics/${slug}/chapter/"]`).each((_, el) => {
				const href = $(el).attr('href') || '';
				if (href) ids.push(href);
			});
			return uniq(ids);
		},
		regex: (html) =>
			uniq(
				Array.from(
					html.matchAll(/<a[^>]*href="(\/comics\/[^"/]+\/chapter\/[^"]*)"[^>]*>/gi),
					(m) => m[1]
				)
			),
		regexLabel: 'one-pass anchor scan'
	},
	{
		name: 'vortex',
		source: new VortexSource(),
		path: "/series/the-hero's-ballad",
		cheerio: (html) => {
			const $ = cheerio.load(html);
			const slug = "the-hero's-ballad";
			const ids: string[] = [];
			$(`a[href*="/series/${slug}/chapter"]`).each((_, el) => {
				const href = $(el).attr('href') || '';
				if (href) ids.push(href);
			});
			return uniq(ids);
		},
		regex: (html) =>
			uniq(Array.from(html.matchAll(/<a[^>]*href="([^"]*\/chapter[^"]*)"[^>]*>/gi), (m) => m[1])),
		regexLabel: 'one-pass anchor scan'
	}
];

console.log(`runs=${runs} (median ms)\n`);
for (const c of cases) {
	const s = c.source as { fetchHtml: (p: string) => Promise<string> };
	const path = c.path;
	const html =
		c.name === 'weebcentral'
			? await cached(c.name, path, {
					fetchHtml: () =>
						(
							c.source as unknown as {
								fetchChapterList: (p: string, seed: string) => Promise<string>;
							}
						).fetchChapterList(path, '01M75W8WQGGCVAFQ9R85F1G6FT')
				})
			: await cached(c.name, path, s);

	const parseMs = time(() => cheerio.load(html));
	const cheerioMs = time(() => c.cheerio(html));
	const regexMs = time(() => c.regex(html));

	const cheerioIds = c.cheerio(html);
	const regexIds = c.regex(html);
	const parity = cheerioIds.length === regexIds.length;

	// Library cost we want to drop: tree build + selector walk on the same bytes.
	const cheerioTotal = +(parseMs + cheerioMs).toFixed(2);
	console.log(
		`${c.name.padEnd(12)} ${(html.length / 1024).toFixed(0).padStart(4)} KB  ` +
			`items cheerio=${String(cheerioIds.length).padStart(4)} regex=${String(regexIds.length).padStart(4)} ` +
			`${parity ? 'parity=ok' : 'parity=DIFF'}  ` +
			`load=${parseMs.toFixed(2)} select=${cheerioMs.toFixed(2)} cheerio=${cheerioTotal.toFixed(2)} ` +
			`regex=${regexMs.toFixed(2)} -> ${(cheerioTotal / regexMs).toFixed(1)}x faster`
	);
}

// Field-level parity, not just counts: the chapter rows carry a date and a number
// that the app shows, so a regex rewrite must reproduce them per row.
{
	const s = new WeebcentralSource() as unknown as {
		extractChapters: (api: cheerio.CheerioAPI) => { id: string; number: number; date: string }[];
	};
	const html = await readFile(`${DIR}/weebcentral.html`, 'utf8');
	const adapter = s.extractChapters(cheerio.load(html));
	const regex = html
		.split(/(?=<div[^>]*checkNewChapter\()/i)
		.slice(1)
		.map((row) => ({
			id: (row.match(/href="([^"]*\/chapters\/[^"\/]+)"/i)?.[1] || '').replace(/^\/*/, '/'),
			number: parseFloat(row.match(/\bChapter\s*([\d.]+)/i)?.[1] || '0'),
			date:
				row.match(/<time[^>]*datetime="([^"]+)"/i)?.[1] ||
				row.match(/checkNewChapter\('([^']+)'\)/i)?.[1] ||
				''
		}))
		.filter((row) => row.id);
	const key = (r: { id: string; number: number; date: string }) => `${r.id}|${r.number}|${r.date}`;
	const a = new Set(adapter.map(key));
	const b = new Set(regex.map(key));
	const missing = [...a].filter((k) => !b.has(k)).length;
	const extra = [...b].filter((k) => !a.has(k)).length;
	const dated = adapter.filter((c) => c.date).length;
	console.log(
		`\nfield parity (weebcentral) adapter=${a.size} regex=${b.size} dated=${dated}/${a.size} ` +
			`mismatch=${missing + extra}`
	);
}
