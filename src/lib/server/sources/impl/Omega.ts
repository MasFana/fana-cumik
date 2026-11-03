import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';

interface OmegaItem {
	id: number;
	series_slug: string;
	title: string;
	thumbnail: string;
	status?: string;
	description?: string;
}

interface OmegaQueryResponse {
	data: OmegaItem[];
}

interface OmegaTag {
	id: number;
	name: string;
}

interface OmegaSeriesDetail {
	id: number;
	series_slug: string;
	title: string;
	thumbnail: string;
	description?: string;
	author?: string;
	status?: string;
	tags?: OmegaTag[];
}

interface OmegaChapterItem {
	id: number;
	chapter_name: string;
	chapter_slug: string;
	chapter_title?: string | null;
	index?: string | number;
	created_at?: string;
}

interface OmegaChapterListResponse {
	data: OmegaChapterItem[];
}

interface OmegaChapterReadResponse {
	chapter: {
		id: number;
		chapter_data?: {
			images?: string[];
		};
	};
}

/**
 * Omega Scans Adapter (omegascans.org)
 * Uses public REST API at https://api.omegascans.org
 */
export class OmegaSource extends BaseSource {
	id = 'omega';
	name = 'Omega Scans';
	baseUrl = 'https://api.omegascans.org';

	protected override headers: Record<string, string> = {
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		Accept: 'application/json'
	};

	private cleanSlug(id: string): string {
		return id.replace(/^\/series\//, '').replace(/\/$/, '').trim();
	}

	/** Omega descriptions arrive as HTML for some series — strip tags/entities. */
	private stripHtml(input: string): string {
		if (!input) return '';
		return input
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/p>/gi, '\n')
			.replace(/<[^>]*>/g, '')
			.replace(/&nbsp;/gi, ' ')
			.replace(/&amp;/gi, '&')
			.replace(/&lt;/gi, '<')
			.replace(/&gt;/gi, '>')
			.replace(/&quot;/gi, '"')
			.replace(/&#0?39;|&apos;/gi, "'")
			.replace(/&ldquo;|&rdquo;/gi, '"')
			.replace(/&lsquo;|&rsquo;/gi, "'")
			.replace(/&hellip;/gi, '…')
			.replace(/&mdash;/gi, '—')
			.replace(/&ndash;/gi, '–')
			.replace(/[ 	]+/g, ' ')
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}

	private toManga(item: OmegaItem): Manga {
		return {
			id: `/series/${item.series_slug}`,
			title: item.title,
			cover: item.thumbnail || '',
			sourceId: this.id
		};
	}

	async getLatestManga(page: number): Promise<Manga[]> {
		try {
			const url = `/query?series_type=Comic&perPage=20&adult=true&order=desc&orderBy=latest&page=${page}`;
			const data = await this.fetchJson<OmegaQueryResponse>(url);
			return (data.data || []).map((item) => this.toManga(item));
		} catch (e) {
			console.error('[Omega] getLatestManga failed:', e);
			return [];
		}
	}

	async searchManga(query: string): Promise<Manga[]> {
		try {
			const url = `/query?query=${encodeURIComponent(query)}&page=1`;
			const data = await this.fetchJson<OmegaQueryResponse>(url);
			return (data.data || []).map((item) => this.toManga(item));
		} catch (e) {
			console.error('[Omega] searchManga failed:', e);
			return [];
		}
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		const slug = this.cleanSlug(mangaId);
		const detail = await this.fetchJson<OmegaSeriesDetail>(`/series/${slug}`);

		const seriesId = detail.id;
		let chapters: Chapter[] = [];

		try {
			const chUrl = `/chapter/query?page=1&perPage=10000&series_id=${seriesId}`;
			const chData = await this.fetchJson<OmegaChapterListResponse>(chUrl);

			chapters = (chData.data || []).map((c) => {
				const numMatch = (c.chapter_name || '').match(/(\d+(?:\.\d+)?)/);
				const number = numMatch ? parseFloat(numMatch[1]) : 0;
				return {
					id: `/series/${slug}/${c.chapter_slug}`,
					title: c.chapter_name || `Chapter ${number}`,
					number,
					date: c.created_at || ''
				};
			});

			chapters.sort((a, b) => b.number - a.number);
		} catch (e) {
			console.error('[Omega] chapters list failed:', e);
		}

		const genres = (detail.tags || []).map((t) => t.name).filter(Boolean);
		const authors = detail.author ? [detail.author] : [];

		return {
			id: slug,
			sourceId: this.id,
			title: detail.title,
			cover: detail.thumbnail || '',
			description: this.stripHtml(detail.description || ''),
			authors,
			status: detail.status || 'Ongoing',
			genres,
			chapters
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		// chapterId format: slug/chapter_slug or /series/slug/chapter_slug
		const cleaned = chapterId.replace(/^\/+/, '').replace(/^series\//, '');
		const parts = cleaned.split('/');
		const slug = parts[0];
		const chapterSlug = parts[1] || parts[0];

		const data = await this.fetchJson<OmegaChapterReadResponse>(`/chapter/${slug}/${chapterSlug}`);
		return data.chapter?.chapter_data?.images || [];
	}
}
