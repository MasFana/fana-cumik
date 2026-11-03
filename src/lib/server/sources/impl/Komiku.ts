import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';
import * as cheerio from 'cheerio';

/**
 * Komiku Adapter (komiku.org)
 * Indonesian manga/manhwa/manhua site.
 * - Latest updates & Search: fetched via api.komiku.org HTML endpoints.
 * - Manga details: fetched from komiku.org/manga/{slug}/.
 * - Chapter pages: resolved via api.komiku.org wp-json post slug lookup,
 *   then loaded from komiku.org/?p={postId} to bypass CF chapter challenge.
 */
export class KomikuSource extends BaseSource {
	id = 'komiku';
	name = 'Komiku';
	baseUrl = 'https://komiku.org';

	private normalizeLink(link: string): string {
		if (link.startsWith('http')) {
			const url = new URL(link);
			return url.pathname + (url.pathname.endsWith('/') ? '' : '/');
		}
		return link.startsWith('/') ? link : `/${link}`;
	}

	async getLatestManga(page: number): Promise<Manga[]> {
		const res: Manga[] = [];
		try {
			// Fetch true latest updates via api.komiku.org
			const url =
				page === 1
					? 'https://api.komiku.org/manga/?orderby=modified'
					: `https://api.komiku.org/manga/page/${page}/?orderby=modified`;

			const html = await this.fetchHtml(url);
			const $ = cheerio.load(html);

			$('.bge').each((_, el) => {
				const $card = $(el);
				const link = $card.find('a').first().attr('href') || '';
				const image =
					$card.find('img').first().attr('data-src') ||
					$card.find('img').first().attr('src') ||
					'';
				const title =
					$card.find('h3').first().text().trim() ||
					$card.find('h4 a').first().text().trim();

				if (title && link) {
					const cleanLink = this.normalizeLink(link);
					res.push({
						id: cleanLink,
						title,
						cover: image.startsWith('http') ? image : (image ? `https:${image}` : ''),
						sourceId: this.id
					});
				}
			});

			if (res.length === 0) {
				// Fallback to alphabetical listing from main site if API returns empty
				const fallbackUrl =
					page === 1
						? `${this.baseUrl}/daftar-komik/`
						: `${this.baseUrl}/daftar-komik/page/${page}/`;
				const fallbackHtml = await this.fetchHtml(fallbackUrl);
				const $fb = cheerio.load(fallbackHtml);

				$fb('.manga-card').each((_, el) => {
					const $card = $fb(el);
					const link = $card.find('h4 a').first().attr('href') || '';
					const image =
						$card.find('img').first().attr('data-src') ||
						$card.find('img').first().attr('src') ||
						'';
					const title = $card.find('h4 a').first().text().trim();

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
			}
		} catch (e) {
			console.error('[Komiku] getLatestManga failed:', e);
		}
		return res;
	}

	async searchManga(query: string, page = 1): Promise<Manga[]> {
		const res: Manga[] = [];
		try {
			const url =
				page > 1
					? `https://api.komiku.org/manga/page/${page}/?s=${encodeURIComponent(query)}&post_type=manga`
					: `https://api.komiku.org/manga/?s=${encodeURIComponent(query)}&post_type=manga`;
			const html = await this.fetchHtml(url);
			const $ = cheerio.load(html);

			$('.bge').each((_, el) => {
				const $card = $(el);
				const link = $card.find('a').first().attr('href') || '';
				const image =
					$card.find('img').first().attr('data-src') ||
					$card.find('img').first().attr('src') ||
					'';
				const title =
					$card.find('h3').first().text().trim() ||
					$card.find('h4 a').first().text().trim();

				if (title && link) {
					const cleanLink = this.normalizeLink(link);
					res.push({
						id: cleanLink,
						title,
						cover: image.startsWith('http') ? image : (image ? `https:${image}` : ''),
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

		const title = $('#Judul h1 span[itemprop="name"], #Judul h1')
			.first()
			.text()
			.trim()
			.replace(/^Komik\s+/i, '');
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
			if (label.includes('Author') || label.includes('Penulis') || label.includes('Pengarang')) {
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

		const mangaSlug = normalizedId.replace(/^\/manga\/|\/+$/g, '');
		const chapters: Chapter[] = [];

		$('#Daftar_Chapter tr:has(a), #daftarChapter tr[itemprop="itemListElement"]').each((i, el) => {
			const $row = $(el);
			const link =
				$row.find('a[itemprop="url"]').attr('href') ||
				$row.find('a').first().attr('href') ||
				'';
			const chapterTitle =
				$row.find('[itemprop="name"]').text().trim() ||
				$row.find('a').first().text().trim();

			if (link) {
				const numMatch =
					chapterTitle.match(/chapter\s*(\d+(?:\.\d+)?)/i) ||
					link.match(/-chapter-(\d+(?:\.\d+)?)/i);
				const number = numMatch ? parseFloat(numMatch[1]) : 0;

				const chSlug = link.replace(/^\/+|\/+$/g, '');
				const cleanLink = `/manga/${mangaSlug}/chapter/${chSlug}`;

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
		const segments = chapterId.split('/').filter(Boolean);
		const clean = segments.at(-1) || chapterId.replace(/^\/+|\/+$/g, '');

		let postId: string | number | null = null;

		if (/^\d+$/.test(clean)) {
			postId = clean;
		} else if (clean.startsWith('?p=')) {
			postId = clean.slice(3);
		} else {
			try {
				const posts = await this.fetchJson<Array<{ id: number }>>(
					`https://api.komiku.org/wp-json/wp/v2/posts?slug=${encodeURIComponent(clean)}`
				);
				if (posts && posts.length > 0) {
					postId = posts[0].id;
				}
			} catch (e) {
				console.warn('[Komiku] Failed to resolve slug via wp-json:', e);
			}
		}

		let html = '';
		if (postId) {
			html = await this.fetchHtml(`/?p=${postId}`);
		} else {
			// Fallback: try fetching path directly
			html = await this.fetchHtml(`/${clean}/`);
		}

		const $ = cheerio.load(html);
		const images: string[] = [];

		$('#Baca_Komik img, .baca-area img, .chapter-content img, #chapter-images img').each(
			(_, el) => {
				const src = $(el).attr('src') || $(el).attr('data-src') || '';
				if (src && !src.includes('komiku-promosi') && !src.endsWith('.gif')) {
					images.push(src.startsWith('http') ? src : `https:${src}`);
				}
			}
		);

		if (images.length === 0) {
			$('#main img, article img, .perapih img').each((_, el) => {
				const src = $(el).attr('src') || $(el).attr('data-src') || '';
				if (src && !src.includes('komiku-promosi') && !src.endsWith('.gif')) {
					images.push(src.startsWith('http') ? src : `https:${src}`);
				}
			});
		}

		return images;
	}
}
