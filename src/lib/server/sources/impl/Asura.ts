import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';
import * as cheerio from 'cheerio';

/**
 * AsuraScans Adapter (asurascans.com)
 * Updated for new Astro-based site structure (2026).
 * Note: Cloudflare protection may block automated requests.
 */
export class AsuraSource extends BaseSource {
	id = 'asura';
	name = 'Asura Scans';
	baseUrl = 'https://asurascans.com';

	async getLatestManga(page: number): Promise<Manga[]> {
		const res: Manga[] = [];
		const html = await this.fetchHtml(`/browse/comics?page=${page}`);
		const $ = cheerio.load(html);

		$('.series-card').each((_, el) => {
			const $card = $(el);
			const link = $card.find('a[href^="/comics/"]').first().attr('href') || '';
			const image = $card.find('img').first().attr('src') || '';
			const title = $card.find('h3').first().text().trim();

			if (title && link) {
				const cleanLink = link.startsWith('/') ? link : `/${link}`;
				res.push({
					id: cleanLink,
					title,
					cover: image.startsWith('http') ? image : `https:${image}`,
					sourceId: this.id
				});
			}
		});

		return res;
	}

	async searchManga(query: string): Promise<Manga[]> {
		const res: Manga[] = [];
		const encodedQuery = encodeURIComponent(query);
		const html = await this.fetchHtml(`/browse/comics?search=${encodedQuery}&page=1`);
		const $ = cheerio.load(html);

		$('.series-card').each((_, el) => {
			const $card = $(el);
			const link = $card.find('a[href^="/comics/"]').first().attr('href') || '';
			const image = $card.find('img').first().attr('src') || '';
			const title = $card.find('h3').first().text().trim();

			if (title && link) {
				const cleanLink = link.startsWith('/') ? link : `/${link}`;
				res.push({
					id: cleanLink,
					title,
					cover: image.startsWith('http') ? image : `https:${image}`,
					sourceId: this.id
				});
			}
		});

		return res;
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		let normalizedId = mangaId;
		if (!normalizedId.startsWith('/comics/')) {
			normalizedId = `/comics${normalizedId.startsWith('/') ? normalizedId : '/' + normalizedId}`;
		}

		const html = await this.fetchHtml(normalizedId);
		const $ = cheerio.load(html);

		// Extract basic info
		const title = $('h1').first().text().trim() || normalizedId;
		const cover = $('img[alt*="cover"], .series-cover img, img[src*="covers/"]').first().attr('src') || '';
		const description = $('#description-text, .series-description, .prose').first().text().trim();

		// Extract chapters from chapter list - new Astro structure
		const chapters: Chapter[] = [];
		
		// Chapter links are: /comics/{slug}/chapter/{num}
		const mangaSlug = normalizedId.replace('/comics/', '');
		const chapterLinks = $(`a[href^="/comics/${mangaSlug}/chapter/"]`);
		
		chapterLinks.each((i, el) => {
			const $el = $(el);
			const link = $el.attr('href') || '';
			const chapterTitle = $el.text().trim();
			
			if (link) {
				const numMatch = chapterTitle.match(/chapter\s*(\d+(?:\.\d+)?)/i) 
					|| link.match(/\/chapter\/(\d+(?:\.\d+)?)/i);
				const number = numMatch ? parseFloat(numMatch[1]) : 0;

				const cleanLink = link.startsWith('/') ? link : `/${link}`;
				chapters.push({
					id: cleanLink,
					title: chapterTitle || `Chapter ${number}`,
					number,
					date: ''
				});
			}
		});

		// Sort by chapter number descending (latest first)
		chapters.sort((a, b) => b.number - a.number);

		return {
			id: normalizedId,
			sourceId: this.id,
			title,
			cover: cover.startsWith('http') ? cover : (cover ? `https:${cover}` : ''),
			description: description || '',
			authors: [],
			status: 'Ongoing',
			genres: [],
			chapters
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		let normalizedPath = chapterId;
		if (!normalizedPath.startsWith('/comics/')) {
			normalizedPath = `/comics${normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath}`;
		}

		const html = await this.fetchHtml(normalizedPath);
		const $ = cheerio.load(html);

		const images: string[] = [];

		// Try to find images in Next.js script data
		const scripts = $('script').toArray();
		for (const script of scripts) {
			const content = $(script).html() || '';
			if (content.includes('pages') || content.includes('chapter-images') || content.includes('imageUrls')) {
				const matches = content.match(/(?:pages|images|imageUrls|chapterImages)\s*[=:]\s*(\[.*?\])/s);
				if (matches && matches[1]) {
					try {
						const pages = JSON.parse(matches[1]) as Array<{url: string} | string>;
						for (const page of pages) {
							const url = typeof page === 'string' ? page : page.url;
							if (url) {
								images.push(url.startsWith('http') ? url : `https://cdn.asurascans.com${url.startsWith('/') ? '' : '/'}${url}`);
							}
						}
						if (images.length > 0) return images;
					} catch {}
				}
			}
		}

		// Fallback: look for img tags in reader container
		$('.chapter-reader img, .reading-content img, [data-page] img, .chapter-content img').each((_, el) => {
			const src = $(el).attr('src') || $(el).attr('data-src') || '';
			if (src && (src.includes('cdn.asurascans.com') || src.includes('asura-images'))) {
				images.push(src.startsWith('http') ? src : `https:${src}`);
			}
		});

		return images;
	}
}
