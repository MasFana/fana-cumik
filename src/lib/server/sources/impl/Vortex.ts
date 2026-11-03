import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';
import * as cheerio from 'cheerio';

export class VortexSource extends BaseSource {
	id = 'vortex';
	name = 'VortexScans';
	baseUrl = 'https://vortexscans.org';

	private abs(src: string): string {
		if (!src) return '';
		if (src.startsWith('http')) return src;
		if (src.startsWith('//')) return `https:${src}`;
		return `${this.baseUrl}${src.startsWith('/') ? '' : '/'}${src}`;
	}

	private cards($: cheerio.CheerioAPI): Manga[] {
		const res: Manga[] = [];
		$('a[href*="/series/"]').each((_, el) => {
			const $a = $(el);
			const href = $a.attr('href') || '';
			const img = $a.find('img').first();
			const src = img.attr('src') || img.attr('data-src') || '';
			const title = img.attr('alt') || $a.find('h3, h2, .title').first().text().trim();
			if (href && title) {
				const id = href.startsWith('http') ? new URL(href).pathname : href;
				res.push({ id, title, cover: this.abs(src), sourceId: this.id });
			}
		});
		// dedupe by id
		return res.filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i);
	}

	async getLatestManga(page: number): Promise<Manga[]> {
		try {
			const html = await this.fetchHtml(`/series?page=${page}`);
			return this.cards(cheerio.load(html));
		} catch (e) {
			console.error('[Vortex] getLatestManga failed:', e);
			return [];
		}
	}

	async searchManga(query: string): Promise<Manga[]> {
		try {
			const html = await this.fetchHtml(`/series?searchTerm=${encodeURIComponent(query)}`);
			return this.cards(cheerio.load(html));
		} catch (e) {
			console.error('[Vortex] searchManga failed:', e);
			return [];
		}
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		const path = mangaId.startsWith('http') ? new URL(mangaId).pathname : mangaId;
		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);

		const title = $('h1').first().text().trim() || path;
		const coverEl = $('img').filter((_, el) => {
			const s = $(el).attr('src') || '';
			return s.includes('cover') || s.includes('thumbnail');
		}).first();
		const cover = this.abs(coverEl.attr('src') || $('img').first().attr('src') || '');
		const description = $('.description, .synopsis, .summary').first().text().trim();

		const genres: string[] = [];
		$('.genres a, .genre a, .tags a').each((_, el) => {
			const g = $(el).text().trim();
			if (g) genres.push(g);
		});

		let status = 'Ongoing';
		$('.status, .info-status').each((_, el) => {
			const v = $(el).text().replace(/status/i, '').trim();
			if (v) status = v;
		});

		const chapters: Chapter[] = [];
		$('a[href*="/chapter"]').each((_, el) => {
			const href = $(el).attr('href') || '';
			const text = $(el).text().trim();
			const numMatch = href.match(/chapter[/-](\d+(?:\.\d+)?)/i) || text.match(/(\d+(?:\.\d+)?)/);
			const number = numMatch ? parseFloat(numMatch[1]) : 0;
			if (href) {
				const id = href.startsWith('http') ? new URL(href).pathname : href;
				chapters.push({ id, title: text || `Chapter ${number}`, number, date: '' });
			}
		});
		chapters.sort((a, b) => b.number - a.number);

		return { id: path, sourceId: this.id, title, cover, description: description || '', authors: [], status, genres, chapters };
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const path = chapterId.startsWith('http') ? new URL(chapterId).pathname : chapterId;
		const html = await this.fetchHtml(path);
		const $ = cheerio.load(html);
		const images: string[] = [];
		$('img').each((_, el) => {
			const src = $(el).attr('src') || $(el).attr('data-src') || '';
			if (src && /\/page-\d+[^/]*\.(?:jpg|jpeg|png|webp)(?:\?|$)/i.test(src)) {
				const abs = this.abs(src);
				if (!images.includes(abs)) images.push(abs);
			}
		});
		if (images.length === 0) {
			$('.reader-container img, #chapter-content img, .chapter-img').each((_, el) => {
				const src = $(el).attr('src') || $(el).attr('data-src') || '';
				if (src) images.push(this.abs(src));
			});
		}
		return images;
	}
}
