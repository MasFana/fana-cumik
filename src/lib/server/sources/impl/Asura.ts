import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';
import * as cheerio from 'cheerio';

/**
 * AsuraScans Adapter (asurascans.com)
 * Astro-based site structure (2026). Cloudflare may block automated requests.
 * - Details: #description-text for synopsis, a[href*="/browse?genres="] for genres,
 *   a[href*="/browse?author="] / a[href*="/browse?artist="] for credits.
 * - Status lives in a card labelled "Status" whose value is the following bold span.
 */
export class AsuraSource extends BaseSource {
	id = 'asura';
	name = 'Asura Scans';
	baseUrl = 'https://asurascans.com';

	private clean(s: string): string {
		return (s || '').replace(/\s+/g, ' ').trim();
	}

	private cards($: cheerio.CheerioAPI): Manga[] {
		const res: Manga[] = [];
		$('.series-card').each((_, el) => {
			const $card = $(el);
			const link = $card.find('a[href^="/comics/"]').first().attr('href') || '';
			const image = $card.find('img').first().attr('src') || '';
			const title = this.clean($card.find('h3').first().text());

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
		return res.filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i);
	}

	async getLatestManga(page: number): Promise<Manga[]> {
		try {
			const html = await this.fetchHtml(`/browse/comics?page=${page}`);
			return this.cards(cheerio.load(html));
		} catch (e) {
			console.error('[Asura] getLatestManga failed:', e);
			return [];
		}
	}

	async searchManga(query: string): Promise<Manga[]> {
		try {
			const html = await this.fetchHtml(`/browse/comics?search=${encodeURIComponent(query)}&page=1`);
			return this.cards(cheerio.load(html));
		} catch (e) {
			console.error('[Asura] searchManga failed:', e);
			return [];
		}
	}

	/** Value of the "Status"/"Type" info card: label div followed by bold value span. */
	private infoCard($: cheerio.CheerioAPI, label: string): string {
		let value = '';
		$('div.text-xs').each((_, el) => {
			const $label = $(el);
			if (this.clean($label.text()).toLowerCase() !== label.toLowerCase()) return;
			const fromCard = this.clean($label.parent().find('span.text-base').first().text());
			if (fromCard) value = fromCard;
		});
		return value;
	}

	private extractGenres($: cheerio.CheerioAPI): string[] {
		const genres: string[] = [];
		$('a[href*="genres="]').each((_, el) => {
			const g = this.clean($(el).text());
			if (g && !genres.some((x) => x.toLowerCase() === g.toLowerCase())) genres.push(g);
		});
		if (genres.length) return genres;

		// Fallback: JSON-LD genre array
		$('script[type="application/ld+json"]').each((_, el) => {
			try {
				const raw = JSON.parse($(el).html() || '{}');
				const nodes = Array.isArray(raw) ? raw : [raw, ...(raw['@graph'] || [])];
				for (const node of nodes) {
					const list = node?.genre;
					if (!list) continue;
					for (const g of Array.isArray(list) ? list : [list]) {
						const name = this.clean(String(g));
						if (name && !genres.some((x) => x.toLowerCase() === name.toLowerCase())) genres.push(name);
					}
				}
			} catch {
				/* ignore malformed JSON-LD */
			}
		});
		return genres;
	}

	private extractAuthors($: cheerio.CheerioAPI): string[] {
		const authors: string[] = [];
		$('a[href*="/browse?author="], a[href*="/browse?artist="]').each((_, el) => {
			const name = this.clean($(el).text());
			if (name && !authors.includes(name)) authors.push(name);
		});
		return authors;
	}

	private extractDescription($: cheerio.CheerioAPI): string {
		const primary = this.clean($('#description-text').first().text());
		if (primary) return primary;
		return this.clean($('.series-description, .prose').first().text());
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		let normalizedId = mangaId;
		if (!normalizedId.startsWith('/comics/')) {
			normalizedId = `/comics${normalizedId.startsWith('/') ? normalizedId : '/' + normalizedId}`;
		}

		const html = await this.fetchHtml(normalizedId);
		const $ = cheerio.load(html);

		const title = this.clean($('h1').first().text()) || normalizedId;
		const cover = $('img[alt*="cover"], .series-cover img, img[src*="covers/"]').first().attr('src') || '';

		// Chapter links are: /comics/{slug}/chapter/{num}. The page repeats the list
		// across tab panels, so dedupe by chapter id.
		const mangaSlug = normalizedId.replace('/comics/', '');
		const chapters: Chapter[] = [];
		const seen = new Set<string>();

		$(`a[href^="/comics/${mangaSlug}/chapter/"]`).each((_, el) => {
			const $el = $(el);
			const link = $el.attr('href') || '';
			if (!link) return;
			// Skip the hero "First Chapter"/"Continue" button
			if ($el.find('[data-continue-label]').length || $el.find('svg.lucide-eye').length) return;

			const cleanLink = link.startsWith('/') ? link : `/${link}`;
			if (seen.has(cleanLink)) return;
			seen.add(cleanLink);

			const numMatch = link.match(/\/chapter\/(\d+(?:[.-]\d+)?)/i);
			const number = numMatch ? parseFloat(numMatch[1]) : 0;

			const chapterTitle = this.clean($el.find('span.font-medium').first().text());
			const chapterDate = this.clean($el.find('span.text-sm.text-white\\/40, span[class*="text-white/40"]').first().text());

			chapters.push({
				id: cleanLink,
				title: chapterTitle || (number ? `Chapter ${number}` : 'Chapter'),
				number,
				date: chapterDate
			});
		});

		chapters.sort((a, b) => b.number - a.number);

		const status = this.infoCard($, 'Status');

		return {
			id: normalizedId,
			sourceId: this.id,
			title,
			cover: cover.startsWith('http') ? cover : cover ? `https:${cover}` : '',
			description: this.extractDescription($),
			authors: this.extractAuthors($),
			status: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Ongoing',
			genres: this.extractGenres($),
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

		// Try to find images in embedded script data
		const scripts = $('script').toArray();
		for (const script of scripts) {
			const content = $(script).html() || '';
			if (content.includes('pages') || content.includes('chapter-images') || content.includes('imageUrls')) {
				const matches = content.match(/(?:pages|images|imageUrls|chapterImages)\s*[=:]\s*(\[.*?\])/s);
				if (matches && matches[1]) {
					try {
						const pages = JSON.parse(matches[1]) as Array<{ url: string } | string>;
						for (const page of pages) {
							const url = typeof page === 'string' ? page : page.url;
							if (url) {
								images.push(url.startsWith('http') ? url : `https://cdn.asurascans.com${url.startsWith('/') ? '' : '/'}${url}`);
							}
						}
						if (images.length > 0) return images;
					} catch {
						/* ignore unparsable payload */
					}
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
