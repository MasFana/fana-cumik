import { BaseSource } from '../BaseSource';
import type { Chapter, Manga, MangaDetails } from '../types';


export class ManhuafastSource extends BaseSource {
	id = 'manhuafast';
	name = 'ManhuaFast';
	baseUrl = 'https://manhuafast.com';

	async getLatestManga(page: number): Promise<Manga[]> {
		const mangas: Manga[] = [];
		const html = await this.fetchHtml(`/page/${page}/`);
		const manga = html.matchAll(/<div\b[^>]*class=["'][^"']*\bcol-6\b[^"']*["'][^>]*>[\s\S]*?href=["']([^"']+)["'][\s\S]*?title=["']([^"']+)["'][\s\S]*?data-src=["']([^"']+)["'][\s\S]*?<\/div>/g)
		for (const match of manga) {
			const [, link, title, image] = match;
			const fl = link.split(".com").pop() || link;

			mangas.push({
				id: fl.startsWith('/') ? fl : `/${fl}`,
				title: title.trim(),
				cover: this.absoluteUrl(image),
				sourceId: this.id
			});
		}
		return mangas;
	}

	async searchManga(query: string): Promise<Manga[]> {
		const html = await this.fetchHtml(`?s=${encodeURIComponent(query)}&post_type=wp-manga&op=&author=&artist=&release=&adult=`);
		const mangas: Manga[] = [];
		const manga = html.matchAll(/<div\b[^>]*class=["'][^"']*\bcol-4\b[^"']*["'][^>]*>[\s\S]*?href=["']([^"']+)["'][\s\S]*?title=["']([^"']+)["'][\s\S]*?data-src=["']([^"']+)["'][\s\S]*?<\/div>/g)
		for (const match of manga) {
			const [, link, title, image] = match;
			const fl = link.split(".com").pop() || link;
			mangas.push({
				id: fl.startsWith('/') ? fl : `/${fl}`,
				title: title.trim(),
				cover: this.absoluteUrl(image),
				sourceId: this.id
			});
		}
		return mangas;
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		const normalizedId = mangaId.startsWith('/') ? mangaId : `/${mangaId}`;
		const html = await this.fetchHtml(normalizedId);

		// Extract metadata from main page
		const coverMatch = html.match(/<div\b[^>]*class=["'][^"']*\bsummary_image\b[^"']*["'][^>]*>[\s\S]*?href=["']([^"']+)["'][\s\S]*?data-src=["']([^"']+)["'][\s\S]*?alt=["']([^"']+)["'][\s\S]*?<\/div>/);
		const cover = coverMatch ? this.absoluteUrl(coverMatch[2]) : '';
		
		const match = html.match(/<div\b[^>]*class=["'][^"']*\bsummary__content\b[^"']*["'][^>]*>[\s\S]*?<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>([\s\S]*?)<\/div>/i);

		let title;
		let descriptionText;

		if (match) {
			// Group 1: The Title
			title = match[1].trim();

			// Group 2: The Description
			descriptionText = match[2]
				.replace(/<[^>]+>/g, ' ')  // 1. Replace all HTML tags with a space
				.replace(/\s+/g, ' ')      // 2. Collapse multiple spaces into one single space
				.trim();                   // 3. Trim leading/trailing whitespace
		}

		// Fetch chapters via AJAX POST as required by Madara themes
		const ajaxUrl = `${this.baseUrl}${normalizedId.endsWith('/') ? normalizedId : normalizedId + '/'}ajax/chapters/`;

		const chapters: Chapter[] = [];
		try {
			const response = await fetch(ajaxUrl, {
				method: 'POST',
				headers: {
					'x-requested-with': 'XMLHttpRequest'
				}
			});
			const chaptersHtml = await response.text();

			const chapterMatches = chaptersHtml.matchAll(/<li\b[^>]*class=["'][^"']*\bwp-manga-chapter\b[^"']*["'][^>]*>[\s\S]*?href=["']([^"']+)["'][\s\S]*?<\/li>/g);

			for (const match of chapterMatches) {
				const link = match[1];
				const fl = link.split(".com").pop() || link;
				const slug = fl.split('/').filter(Boolean).pop() || '';
				const numberMatch = slug.match(/chapter-(\d+(?:\.\d+)?)/i);

				chapters.push({
					id: fl.startsWith('/') ? fl : `/${fl}`,
					title: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Chapter',
					number: numberMatch ? parseFloat(numberMatch[1]) : 0,
					date: ''
				});
			}
		} catch (e) {
			console.error(`[ManhuaFast] Failed to fetch chapters from AJAX:`, e);
		}

		return {
			id: normalizedId,
			title : title||normalizedId,
			cover,
			description: descriptionText|| "",
			authors: [],
			genres: [],
			chapters,
			sourceId: this.id,
			status: 'Ongoing',
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const html = await this.fetchHtml(chapterId);
		const images: string[] = []
		const image = html.matchAll(/<div\b[^>]*class=["'][^"']*\bpage-break no-gaps\b[^"']*["'][^>]*>[\s\S]*?data-src=["']([^"']+)["'][\s\S]*?<\/div>/g)


		for (const match of image) {
			const [, imgUrl] = match;
			images.push(imgUrl.replace(/\s+/g, ''));
		}
		return images;


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
