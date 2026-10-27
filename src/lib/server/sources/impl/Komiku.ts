import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';
import * as cheerio from 'cheerio';

/**
 * Komiku Adapter (komiku.org)
 * Indonesian manga/manhwa/manhua site.
 * Uses API endpoint (api.komiku.org) for listings.
 * Server-rendered HTML, no Cloudflare challenge.
 */
export class KomikuSource extends BaseSource {
	id = 'komiku';
	name = 'Komiku';
	baseUrl = 'https://komiku.org';
	apiBase = 'https://api.komiku.org';

	private normalizeLink(link: string): string {
		// Handle both absolute and relative URLs
		if (link.startsWith('http')) {
			const url = new URL(link);
			return url.pathname + (url.pathname.endsWith('/') ? '' : '/');
		}
		return link.startsWith('/') ? link : `/${link}`;
	}

	async getLatestManga(page: number): Promise<Manga[]> {
		const res: Manga[] = [];
		try {
			const html = await this.fetchHtml(`${this.apiBase}/manga/${page > 1 ? `page/${page}/` : ''}?orderby=date`);
			const $ = cheerio.load(html);

			$('.bge').each((_, el) => {
				const $card = $(el);
				const link = $card.find('.bgei a[href*="/manga/"]').first().attr('href') 
					|| $card.find('.kan a[href*="/manga/"]').first().attr('href') || '';
				const image = $card.find('.bgei img').first().attr('src') || '';
				const title = $card.find('.kan h3').first().text().trim() 
					|| $card.find('.kan a').first().text().trim();

				if (title && link) {
					const cleanLink = this.normalizeLink(link);
					res.push({
						id: cleanLink,
						title,
						cover: image.startsWith('http') ? image : `https:${image}`,
						sourceId: this.id
					});
				}
			});
		} catch (e) {
			console.error('[Komiku] getLatestManga failed:', e);
		}
		return res;
	}

	async searchManga(query: string): Promise<Manga[]> {
		const res: Manga[] = [];
		try {
			const encodedQuery = encodeURIComponent(query);
			const html = await this.fetchHtml(`${this.apiBase}/manga/?s=${encodedQuery}&post_type=manga`);
			const $ = cheerio.load(html);

			$('.bge').each((_, el) => {
				const $card = $(el);
				const link = $card.find('.bgei a[href*="/manga/"]').first().attr('href') 
					|| $card.find('.kan a[href*="/manga/"]').first().attr('href') || '';
				const image = $card.find('.bgei img').first().attr('src') || '';
				const title = $card.find('.kan h3').first().text().trim() 
					|| $card.find('.kan a').first().text().trim();

				if (title && link) {
					const cleanLink = this.normalizeLink(link);
					res.push({
						id: cleanLink,
						title,
						cover: image.startsWith('http') ? image : `https:${image}`,
						sourceId: this.id
					});
				}
			});
		} catch (e) {
			console.error('[Komiku] searchManga failed:', e);
		}
		return res;
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		let normalizedId = mangaId;
		if (!normalizedId.startsWith('/manga/')) {
			normalizedId = `/manga${normalizedId.startsWith('/') ? normalizedId : '/' + normalizedId}`;
		}
		if (!normalizedId.endsWith('/')) {
			normalizedId += '/';
		}

		const html = await this.fetchHtml(normalizedId);
		const $ = cheerio.load(html);

		const title = $('#Judul h1 span[itemprop="name"], #Judul h1').first().text().trim().replace(/^Komik\s+/i, '');
		const cover = $('#Informasi .ims img, img[itemprop="image"]').first().attr('src') || '';
		const description = $('.desc[itemprop="description"], #Informasi .desc').first().text().trim();

		const genres: string[] = [];
		$('.genre li a span, .genre a span').each((_, el) => {
			const g = $(el).text().trim();
			if (g) genres.push(g);
		});

		let author = '';
		$('table.inftable tr').each((_, el) => {
			const $row = $(el);
			const label = $row.find('td').first().text().trim();
			if (label.includes('Author') || label.includes('Penulis')) {
				author = $row.find('td').last().text().trim();
			}
		});

		let status = 'Ongoing';
		$('table.inftable tr').each((_, el) => {
			const $row = $(el);
			const label = $row.find('td').first().text().trim();
			if (label.includes('Status')) {
				status = $row.find('td').last().text().trim();
			}
		});

		const chapters: Chapter[] = [];
		$('#daftarChapter tr[itemprop="itemListElement"], #Daftar_Chapter tbody tr').each((i, el) => {
			const $row = $(el);
			const link = $row.find('a[itemprop="url"]').attr('href') || $row.find('a').first().attr('href') || '';
			const chapterTitle = $row.find('[itemprop="name"]').text().trim() || $row.find('a').first().text().trim();
			
			if (link) {
				const numMatch = chapterTitle.match(/chapter\s*(\d+(?:\.\d+)?)/i) 
					|| link.match(/-chapter-(\d+(?:\.\d+)?)/i);
				const number = numMatch ? parseFloat(numMatch[1]) : 0;

				const cleanLink = this.normalizeLink(link);
				chapters.push({
					id: cleanLink,
					title: chapterTitle || `Chapter ${number}`,
					number,
					date: $row.find('.tanggalseries').text().trim()
				});
			}
		});

		chapters.sort((a, b) => b.number - a.number);

		return {
			id: normalizedId,
			sourceId: this.id,
			title: title || normalizedId,
			cover: cover.startsWith('http') ? cover : (cover ? `https:${cover}` : ''),
			description: description || '',
			authors: author ? [author] : [],
			status,
			genres,
			chapters
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		let normalizedPath = chapterId;
		if (!normalizedPath.startsWith('/')) {
			normalizedPath = `/${normalizedPath}`;
		}
		if (!normalizedPath.endsWith('/')) {
			normalizedPath += '/';
		}

		const html = await this.fetchHtml(normalizedPath);
		const $ = cheerio.load(html);

		const images: string[] = [];

		$('.baca-area img, .chapter-content img, #chapter-images img, .reading-content img').each((_, el) => {
			const src = $(el).attr('src') || $(el).attr('data-src') || '';
			if (src && (src.includes('thumbnail.komiku') || src.includes('komiku.to') || src.includes('komiku.org') || src.includes('img.komiku'))) {
				images.push(src.startsWith('http') ? src : `https:${src}`);
			}
		});

		if (images.length === 0) {
			$('#main img, article img, .perapih img').each((_, el) => {
				const src = $(el).attr('src') || $(el).attr('data-src') || '';
				if (src && (src.includes('thumbnail.komiku') || src.includes('komiku.to') || src.includes('komiku.org') || src.includes('img.komiku'))) {
					images.push(src.startsWith('http') ? src : `https:${src}`);
				}
			});
		}

		return images;
	}
}
