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
		// Normalize path
		let normalizedPath = chapterId;
		if (!normalizedPath.startsWith('/series/') && !normalizedPath.startsWith('/series')) {
			normalizedPath = '/series/' + normalizedPath.replace(/^\//, '');
		}

		const html = await this.fetchHtml(normalizedPath);

		// 1. Combine all script tags content that might contain the data
		// Asura uses Next.js App Router, data is in self.__next_f.push
		const $ = cheerio.load(html);
		let scriptData = '';
		$('script').each((i, el) => {
			const content = $(el).html() || '';
			if (content.includes('self.__next_f.push')) {
				scriptData += content;
			}
		});

		// If cheerio fails to find scripts, fallback to raw html regex
		if (!scriptData) scriptData = html;

		// 2. Regex to find the "pages" JSON array
		// Pattern: "pages":[{ ... }]
		// We look for escaped quote \"pages\" followed by the array
		const pagesMatch = scriptData.match(/\\"pages\\":(\[.*?\])/);

		if (!pagesMatch || !pagesMatch[1]) {
			// Fallback: Sometimes it might not be escaped if the format changes
			const fallbackMatch = scriptData.match(/"pages":(\[.*?\])/);
			if (!fallbackMatch) {
				console.error('Could not find pages data in script');
				return [];
			}
			return this.parsePagesJson(fallbackMatch[1]);
		}

		// 3. Clean the string and Parse JSON
		// The data is often double-escaped in the script string
		const rawJson = pagesMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');

		return this.parsePagesJson(rawJson);
	}

	private parsePagesJson(jsonString: string): string[] {
		try {
			const pages = JSON.parse(jsonString) as { order: number; url: string }[];

			// Sort by order just in case
			pages.sort((a, b) => a.order - b.order);

			// Extract URLs
			return pages.map((page) => {
				const url = page.url;
				if (url.startsWith('http')) return url;
				// Fix relative URLs
				return `https://gg.asuracomic.net${url.startsWith('/') ? '' : '/'}${url}`;
			});
		} catch (e) {
			console.error('Failed to parse chapter pages JSON', e);
			return [];
		}
	}
}
