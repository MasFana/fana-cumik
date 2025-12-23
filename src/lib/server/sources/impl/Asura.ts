import { debug } from '$lib/utils/debug';
import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';
import * as cheerio from 'cheerio';

/**
 * AsuraComic Adapter
 *
 * Real working adapter for asuracomic.net based on proven scraping logic.
 */
export class AsuraSource extends BaseSource {
	id = 'asura';
	name = 'Asura Scans';
	baseUrl = 'https://asuracomic.net';

	async getLatestManga(_page: number): Promise<Manga[]> {
		const res: Manga[] = [];
		const html = await this.fetchHtml(`/page/${_page}`);
		const $ = cheerio.load(html);

		const elements = $('.grid.grid-rows-1.grid-cols-1.sm\\:grid-cols-2.bg-\\[\\#222222\\].p-3.pb-0');

		$(elements)
			.find('div.w-full.p-1.pt-1.pb-3')
			.each((_, e) => {
				const titleEl = $(e).find('span').has('a');
				const image = $(e).find('img').attr('src') || '';
				const link = titleEl.find('a').attr('href') || '';
				const title = titleEl.text().split('Chapter')[0].trim();

				if (title && link) {
					// Strip /series/ prefix to keep app IDs clean
					const cleanLink = link.replace(/\/series\//, '/').replace(/^\/?/, '/');
					res.push({
						id: cleanLink,
						title,
						cover: image,
						sourceId: this.id
					});
				}
			});

		return res;
	}

async searchManga(query: string): Promise<Manga[]> {
    const res: Manga[] = [];
    const encodedQuery = encodeURIComponent(query);
    const html = await this.fetchHtml(`/series?page=1&name=${encodedQuery}`);
    const $ = cheerio.load(html);

    // Target the specific grid container using the classes from your snippet
    const elements = $('div.grid.grid-cols-2.gap-3.p-4 > a');

    elements.each((_, el) => {
        const item = $(el);
        
        // Extract Image
        const image = item.find('img').attr('src') || '';
        
        // Extract Title
        // The title is in the first span with font-bold inside the text block
        // <span class="block text-[13.3px] font-bold">Title</span>
        const title = item.find('span.block.font-bold').first().text().trim();
        
        // Extract Link
        const link = item.attr('href') || '';

        if (title && link) {
            // Clean the link to get the ID
            // Input: "series/emperor-of-solo-play-e4516cae" -> Output: "/emperor-of-solo-play-e4516cae"
            const cleanLink = link.replace(/^series\//, '/').replace(/^\/?/, '/');
            
            res.push({
                id: cleanLink,
                title: title,
                cover: image,
                sourceId: this.id
            });
        }
    });

    return res;
}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		// Asura specific: Ensure /series or /comic prefix
		let normalizedId = mangaId;
		if (!normalizedId.startsWith('/series') && !normalizedId.startsWith('/comic')) {
			normalizedId = `/series${normalizedId.startsWith('/') ? normalizedId : '/' + normalizedId}`;
		}
		
		const html = await this.fetchHtml(normalizedId);
		const $ = cheerio.load(html);

		// Extract basic info
		const title = $('h1, .text-xl.font-bold').first().text().trim();
		const cover = $('img[alt*="poster"], .series-cover img').first().attr('src') || '';
		const description = $('span.text-\\[\\#A2A2A2\\], p.text-sm, .summary, .description').first().text().trim();

		// Extract chapters from scrollbar-thin container
		const chapters: Chapter[] = [];
		const chapterElements = $('.scrollbar-thin').find('div').has('h3');

		chapterElements.each((i, el) => {
			const $el = $(el);
			const chapterTitle =
				$el.find('h3').first().text() + ' ' + $el.find('h3').last().text();
			const link = $el.find('a').attr('href') || '';

			// Extract chapter number from title
			const numMatch = chapterTitle.match(/chapter\s*(\d+(?:\.\d+)?)/i);
			const number = numMatch ? parseFloat(numMatch[1]) : i + 1;

			if (link) {
				let id = link.startsWith('/') ? link : `/${link}`;
				// Strip /series/ prefix for clean app IDs
				// Asura links are usually /series/slug/chapter-x
				id = id.replace(/\/series\//, '/');
				if (!id.startsWith('/')) id = '/' + id;

				chapters.push({
					id,
					title: chapterTitle.trim() || `Chapter ${number}`,
					number,
					date: ''
				});
			}
		});

		// Return ID without /series prefix
		const cleanMangaId = mangaId.replace(/\/series\//, '/').replace(/\/series$/, '');

		return {
			id: cleanMangaId,
			sourceId: this.id,
			title,
			cover,
			description,
			authors: [],
			status: 'Ongoing',
			genres: [],
			chapters
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const res: string[] = [];

		// Normalize the chapter path
		let normalizedPath = chapterId;
		if (!normalizedPath.startsWith('/series/') && !normalizedPath.startsWith('/series')) {
			normalizedPath = '/series/' + normalizedPath.replace(/^\//, '');
		}

		const html = await this.fetchHtml(normalizedPath);

		// Try multiple regex patterns
		const patterns = [
			/\/storage\/media\/\d+\/conversions\/\d{2}-optimized\.webp/gm,
			/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp|gif)/gim,
			/gg\.asuracomic\.net[^"'\s]+\.webp/gim,
			/src="([^"]*(?:storage|media)[^"]*\.(?:jpg|jpeg|png|webp))"/gim
		];

		for (let i = 0; i < patterns.length; i++) {
			const matches = html.match(patterns[i]);
			if (matches && matches.length > 0) {
				// Process matches based on pattern type
				const uniqueMatches = [...new Set(matches)];

				uniqueMatches.forEach((match) => {
					let url = match;

					// If it's a relative path, add the base
					if (url.startsWith('/storage')) {
						url = 'https://gg.asuracomic.net' + url;
					}
					// For src="" pattern, extract the URL
					if (match.includes('src="')) {
						const srcMatch = match.match(/src="([^"]+)"/);
						if (srcMatch) url = srcMatch[1];
					}
					// Make sure it's a full URL
					if (!url.startsWith('http')) {
						if (url.startsWith('//')) {
							url = 'https:' + url;
						} else if (url.startsWith('gg.asuracomic.net')) {
							url = 'https://' + url;
						}
					}

					if (!res.includes(url)) {
						res.push(url);
					}
				});

				// If we found results, don't try other patterns
				if (res.length > 0) {
					// Return half if there are duplicates (common in these sites)
					return res.length > 20 ? res.slice(0, Math.ceil(res.length / 2)) : res;
				}
			}
		}

		return res;
	}
}
