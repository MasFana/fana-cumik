import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';
import * as cheerio from 'cheerio';

/**
 * Sample MangaLife adapter implementation.
 *
 * NOTE: This is a template based on common manga site structures.
 * You will need to inspect the actual target site's HTML and adjust
 * the CSS selectors accordingly.
 */
export class MangalifeSource extends BaseSource {
	id = 'mangalife';
	name = 'MangaLife';
	baseUrl = 'https://manga4life.com';

	async getLatestManga(page: number): Promise<Manga[]> {
		const html = await this.fetchHtml(`/search/?sort=vm&desc=true&page=${page}`);
		const $ = cheerio.load(html);
		const mangas: Manga[] = [];

		// Selector based on common manga site patterns
		// Adjust according to actual site structure
		$('.manga-list .manga-item, .search-results .result-item').each((_, el) => {
			const $el = $(el);
			const link = $el.find('a').first();
			const href = link.attr('href') || '';
			const title = $el.find('.manga-title, .title, h3').text().trim();
			const cover = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';

			if (href && title) {
				mangas.push({
					id: href.startsWith('/') ? href : `/${href}`,
					title,
					cover: this.absoluteUrl(cover),
					sourceId: this.id
				});
			}
		});

		return mangas;
	}

	async searchManga(query: string): Promise<Manga[]> {
		const html = await this.fetchHtml(`/search/?keyword=${encodeURIComponent(query)}`);
		const $ = cheerio.load(html);
		const mangas: Manga[] = [];

		$('.manga-list .manga-item, .search-results .result-item, .SeriesResult').each((_, el) => {
			const $el = $(el);
			const link = $el.find('a').first();
			const href = link.attr('href') || '';
			const title = $el.find('.manga-title, .title, h3, .SeriesName').text().trim();
			const cover = $el.find('img').attr('src') || $el.find('img').attr('data-src') || '';

			if (href && title) {
				mangas.push({
					id: href.startsWith('/') ? href : `/${href}`,
					title,
					cover: this.absoluteUrl(cover),
					sourceId: this.id
				});
			}
		});

		return mangas;
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		const html = await this.fetchHtml(mangaId);
		const $ = cheerio.load(html);

		// Extract basic info
		const title = $('h1, .manga-title, .SeriesName').first().text().trim();
		const cover =
			$('.cover img, .manga-cover img, .SeriesImage img').attr('src') ||
			$('.cover img, .manga-cover img, .SeriesImage img').attr('data-src') ||
			'';
		const description = $('.summary, .description, .Content').text().trim();

		// Extract authors (common patterns)
		const authors: string[] = [];
		$('.author a, .AuthorName').each((_, el) => {
			const author = $(el).text().trim();
			if (author) authors.push(author);
		});

		// Extract status
		const status =
			$('.status, .PublishStatus')
				.text()
				.replace(/status:?/i, '')
				.trim() || 'Unknown';

		// Extract genres
		const genres: string[] = [];
		$('.genre a, .genres a, .GenreTag').each((_, el) => {
			const genre = $(el).text().trim();
			if (genre) genres.push(genre);
		});

		// Extract chapters
		const chapters: Chapter[] = [];
		$('.chapter-list li, .ChapterList a, .chapter-item').each((_, el) => {
			const $el = $(el);
			const link = $el.is('a') ? $el : $el.find('a').first();
			const href = link.attr('href') || '';
			const chapterTitle = link.text().trim();

			// Try to extract chapter number from text or URL
			const numMatch = chapterTitle.match(/chapter\s*(\d+(?:\.\d+)?)/i) || href.match(/chapter-(\d+)/i);
			const number = numMatch ? parseFloat(numMatch[1]) : 0;

			// Extract date if available
			const date = $el.find('.date, .chapter-date, time').text().trim() || '';

			if (href) {
				chapters.push({
					id: href.startsWith('/') ? href : `/${href}`,
					title: chapterTitle || `Chapter ${number}`,
					number,
					date
				});
			}
		});

		return {
			id: mangaId,
			sourceId: this.id,
			title,
			cover: this.absoluteUrl(cover),
			description,
			authors,
			status,
			genres,
			chapters
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const html = await this.fetchHtml(chapterId);
		const $ = cheerio.load(html);
		const pages: string[] = [];

		// Common patterns for chapter page images
		$('.reader-area img, .chapter-images img, .ImageGallery img, .viewer img').each((_, el) => {
			const src = $(el).attr('src') || $(el).attr('data-src') || '';
			if (src && !src.includes('loading') && !src.includes('placeholder')) {
				pages.push(this.absoluteUrl(src));
			}
		});

		// Some sites store images in a JavaScript variable
		// Check for common patterns like: var MainFunction = ...
		if (pages.length === 0) {
			const scriptMatch = html.match(/MainFunction\s*=\s*function\s*\(.*?\)\s*\{[\s\S]*?(\[.*?\])/);
			if (scriptMatch) {
				try {
					// Try to parse as JSON array
					const urls = JSON.parse(scriptMatch[1].replace(/'/g, '"'));
					pages.push(...urls.map((u: string) => this.absoluteUrl(u)));
				} catch {
					// Failed to parse, skip
				}
			}
		}

		return pages;
	}

	/**
	 * Convert relative URLs to absolute URLs.
	 */
	private absoluteUrl(url: string): string {
		if (!url) return '';
		if (url.startsWith('http')) return url;
		if (url.startsWith('//')) return `https:${url}`;
		return `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
	}
}
