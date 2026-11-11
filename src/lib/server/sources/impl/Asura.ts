import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';

/**
 * AsuraScans Adapter (asurascans.com)
 * Astro-based site structure (2026). Cloudflare may block automated requests.
 * - Details: #description-text for synopsis, a[href*="/browse?genres="] for genres,
 *   a[href*="/browse?author="] / a[href*="/browse?artist="] for credits.
 * - Status lives in a card labelled "Status" whose value is the following bold span.
 *
 * Parsing is regex over the raw HTML (no DOM); see BaseSource for the readers.
 */
export class AsuraSource extends BaseSource {
	id = 'asura';
	name = 'Asura Scans';
	baseUrl = 'https://asurascans.com';

	private clean(s: string): string {
		return (s || '').replace(/\s+/g, ' ').trim();
	}

	private firstImg(html: string): string {
		return BaseSource.attr(BaseSource.tag(html, /<img\b[^>]*>/i), 'src');
	}

	/** The element around the first match of `marker`, or '' when absent. */
	private region(html: string, marker: RegExp): string {
		const at = html.search(marker);
		return at < 0 ? '' : BaseSource.elementAt(html, at);
	}

	/** JSON-LD nodes of every `application/ld+json` block on the page. */
	private jsonLd(html: string): Record<string, unknown>[] {
		const nodes: Record<string, unknown>[] = [];
		for (const block of BaseSource.tags(
			html,
			/<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi
		)) {
			try {
				const raw = JSON.parse(BaseSource.inner(block, 'script') || '{}') as
					| Record<string, unknown>
					| Record<string, unknown>[];
				const list = Array.isArray(raw) ? raw : [raw, ...((raw['@graph'] as []) || [])];
				for (const node of list) if (node && typeof node === 'object') nodes.push(node);
			} catch {
				/* ignore malformed JSON-LD */
			}
		}
		return nodes;
	}

	private cards(html: string): Manga[] {
		const res: Manga[] = [];
		for (const { body } of BaseSource.records(
			html,
			/<div[^>]*\bclass="[^"]*\bseries-card\b[^"]*"[^>]*>/gi
		)) {
			const link =
				BaseSource.attr(BaseSource.tag(body, /<a\b[^>]*href="\/comics\/[^"]*"[^>]*>/i), 'href') ||
				'';
			const image = this.firstImg(body);
			const title = this.clean(BaseSource.text(BaseSource.tag(body, /<h3\b[^>]*>[\s\S]*?<\/h3>/i)));

			if (title && link) {
				const cleanLink = link.startsWith('/') ? link : `/${link}`;
				res.push({
					id: cleanLink,
					title,
					cover: image.startsWith('http') ? image : `https:${image}`,
					sourceId: this.id
				});
			}
		}
		return res.filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i);
	}

	async getLatestManga(page: number): Promise<Manga[]> {
		try {
			const html = await this.fetchHtml(`/browse/comics?page=${page}`);
			return this.cards(html);
		} catch (e) {
			console.error('[Asura] getLatestManga failed:', e);
			return [];
		}
	}

	async searchManga(query: string): Promise<Manga[]> {
		try {
			const html = await this.fetchHtml(
				`/browse/comics?search=${encodeURIComponent(query)}&page=1`
			);
			return this.cards(html);
		} catch (e) {
			console.error('[Asura] searchManga failed:', e);
			return [];
		}
	}

	/** Value of the info card whose label reads `label`: its first `span.text-base`. */
	private infoCard(html: string, label: string): string {
		for (const { body, at } of BaseSource.records(
			html,
			/<div[^>]*\bclass="[^"]*\btext-xs\b[^"]*"[^>]*>/gi
		)) {
			if (
				this.clean(BaseSource.text(BaseSource.inner(body, 'div'))).toLowerCase() !==
				label.toLowerCase()
			)
				continue;
			const card = BaseSource.elementAt(html, at - 1);
			const value = this.clean(
				BaseSource.text(
					BaseSource.tag(
						card,
						/<span\b[^>]*\bclass="[^"]*\btext-base\b[^"]*"[^>]*>[\s\S]*?<\/span>/i
					)
				)
			);
			if (value) return value;
		}
		return '';
	}

	private extractGenres(html: string): string[] {
		const genres: string[] = [];
		for (const tag of BaseSource.tags(
			html,
			/<a\b[^>]*href="[^"]*genres=[^"]*"[^>]*>[\s\S]*?<\/a>/gi
		)) {
			const g = this.clean(BaseSource.text(tag));
			if (g && !genres.some((x) => x.toLowerCase() === g.toLowerCase())) genres.push(g);
		}
		if (genres.length) return genres;

		// Fallback: JSON-LD genre array
		for (const node of this.jsonLd(html)) {
			const list = node.genre as unknown;
			if (!list) continue;
			for (const g of Array.isArray(list) ? list : [list]) {
				const name = this.clean(String(g));
				if (name && !genres.some((x) => x.toLowerCase() === name.toLowerCase())) genres.push(name);
			}
		}
		return genres;
	}

	private extractAuthors(html: string): string[] {
		const authors: string[] = [];
		for (const tag of BaseSource.tags(
			html,
			/<a\b[^>]*href="[^"]*\/browse\?(?:author|artist)=[^"]*"[^>]*>[\s\S]*?<\/a>/gi
		)) {
			const name = this.clean(BaseSource.text(tag));
			if (name && !authors.includes(name)) authors.push(name);
		}
		return authors;
	}

	private extractDescription(html: string): string {
		const primary = this.clean(BaseSource.text(this.region(html, /id="description-text"/i)));
		if (primary) return primary;
		const starts = [
			html.search(/class="[^"]*\bseries-description\b[^"]*"/i),
			html.search(/class="[^"]*\bprose\b[^"]*"/i)
		]
			.filter((i) => i >= 0)
			.sort((a, b) => a - b);
		return starts.length ? this.clean(BaseSource.text(BaseSource.elementAt(html, starts[0]))) : '';
	}

	/** First cover image: `/covers/` src or a `cover` alt, then og:image, then JSON-LD. */
	private extractCover(html: string): string {
		for (const { body } of BaseSource.records(html, /<img\b[^>]*>/gi)) {
			const src = BaseSource.attr(body, 'src');
			if (src.includes('/covers/') || BaseSource.attr(body, 'alt').includes('cover')) return src;
		}
		const og = BaseSource.attr(
			BaseSource.tag(html, /<meta\b[^>]*property="og:image"[^>]*>/i),
			'content'
		);
		if (og) return og;
		for (const node of this.jsonLd(html)) {
			const image = node.image as string | { url?: string } | undefined;
			const url = typeof image === 'string' ? image : image?.url;
			if (typeof url === 'string') return url;
		}
		return '';
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		let normalizedId = mangaId;
		if (!normalizedId.startsWith('/comics/')) {
			normalizedId = `/comics${normalizedId.startsWith('/') ? normalizedId : '/' + normalizedId}`;
		}

		const html = await this.fetchHtml(normalizedId);

		const title = this.clean(BaseSource.text(BaseSource.tag(html, /<h1\b[^>]*>[\s\S]*?<\/h1>/i)));
		const cover = this.extractCover(html);

		// Chapter links are: /comics/{slug}/chapter/{num}. The page repeats the list
		// across tab panels, so dedupe by chapter id.
		const mangaSlug = normalizedId.replace('/comics/', '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const chapters: Chapter[] = [];
		const seen = new Set<string>();

		for (const { body } of BaseSource.records(
			html,
			new RegExp(`<a\\b[^>]*href="/comics/${mangaSlug}/chapter/[^"]*"[^>]*>`, 'gi')
		)) {
			const link = BaseSource.attr(BaseSource.open(body), 'href');
			if (!link) continue;
			// Skip the hero "First Chapter"/"Continue" button
			if (
				/data-continue-label/i.test(body) ||
				/<svg\b[^>]*\bclass="[^"]*\blucide-eye\b/i.test(body)
			)
				continue;

			const cleanLink = link.startsWith('/') ? link : `/${link}`;
			if (seen.has(cleanLink)) continue;
			seen.add(cleanLink);

			const numMatch = link.match(/\/chapter\/(\d+(?:[.-]\d+)?)/i);
			const number = numMatch ? parseFloat(numMatch[1]) : 0;

			const chapterTitle = this.clean(
				BaseSource.text(
					BaseSource.tag(
						body,
						/<span\b[^>]*\bclass="[^"]*\bfont-medium\b[^"]*"[^>]*>[\s\S]*?<\/span>/i
					)
				)
			);
			const chapterDate = this.clean(
				BaseSource.text(
					BaseSource.tag(
						body,
						/<span\b[^>]*\bclass="[^"]*\btext-sm\b[^"]*\btext-white\/40\b[^"]*"[^>]*>[\s\S]*?<\/span>/i
					)
				)
			);

			chapters.push({
				id: cleanLink,
				title: chapterTitle || (number ? `Chapter ${number}` : 'Chapter'),
				number,
				date: chapterDate
			});
		}

		chapters.sort((a, b) => b.number - a.number);

		const status = this.infoCard(html, 'Status');

		return {
			id: normalizedId,
			sourceId: this.id,
			title: title || normalizedId,
			cover: cover.startsWith('http') ? cover : cover ? `https:${cover}` : '',
			description: this.extractDescription(html),
			authors: this.extractAuthors(html),
			status: status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Ongoing',
			genres: this.extractGenres(html),
			chapters
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		let normalizedPath = chapterId;
		if (!normalizedPath.startsWith('/comics/')) {
			normalizedPath = `/comics${normalizedPath.startsWith('/') ? normalizedPath : '/' + normalizedPath}`;
		}

		const html = await this.fetchHtml(normalizedPath);

		const images: string[] = [];

		// Try to find images in embedded script data
		for (const { body } of BaseSource.records(html, /<script\b[^>]*>/gi)) {
			const content = BaseSource.inner(body, 'script');
			if (
				!content.includes('pages') &&
				!content.includes('chapter-images') &&
				!content.includes('imageUrls')
			) {
				continue;
			}
			const matches = content.match(/(?:pages|images|imageUrls|chapterImages)\s*[=:]\s*(\[.*?\])/s);
			if (matches && matches[1]) {
				try {
					const pages = JSON.parse(matches[1]) as Array<{ url: string } | string>;
					for (const page of pages) {
						const url = typeof page === 'string' ? page : page.url;
						if (url) {
							images.push(
								url.startsWith('http')
									? url
									: `https://cdn.asurascans.com${url.startsWith('/') ? '' : '/'}${url}`
							);
						}
					}
					if (images.length > 0) return images;
				} catch {
					/* ignore unparsable payload */
				}
			}
		}

		// Fallback: reader images, as `[data-page] img` on this site version.
		for (const { body, before } of BaseSource.records(html, /<img\b[^>]*>/gi)) {
			const src = BaseSource.attr(body, 'src') || BaseSource.attr(body, 'data-src');
			if (!src || !(src.includes('cdn.asurascans.com') || src.includes('asura-images'))) continue;
			if (!/\bdata-page\s*=/i.test(before.slice(before.lastIndexOf('</div>') + 6))) continue;
			images.push(src.startsWith('http') ? src : `https:${src}`);
		}

		return images;
	}
}
