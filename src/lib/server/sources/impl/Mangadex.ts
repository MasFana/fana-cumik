import { BaseSource } from '../BaseSource';
import type { Manga, MangaDetails, Chapter } from '../types';

interface MDRelationship {
	id: string;
	type: string;
	attributes?: Record<string, string>;
}

interface MDAttributes {
	title: Record<string, string>;
	description: Record<string, string>;
	status: string;
	tags: Array<{ attributes: { name: Record<string, string> } }>;
	fileName?: string;
}

interface MDItem {
	id: string;
	attributes: MDAttributes;
	relationships: MDRelationship[];
}

interface MDResponse {
	data: MDItem[];
}

interface MDSingleResponse {
	data: MDItem;
}

interface MDChapterAttributes {
	chapter: string | null;
	title: string | null;
	publishAt: string;
}

interface MDChapterItem {
	id: string;
	attributes: MDChapterAttributes;
}

interface MDChapterResponse {
	data: MDChapterItem[];
}

interface MDAtHomeResponse {
	baseUrl: string;
	chapter: {
		hash: string;
		data: string[];
		dataSaver?: string[];
	};
}

export class MangadexSource extends BaseSource {
	id = 'mangadex';
	name = 'MangaDex';
	baseUrl = 'https://api.mangadex.org';

	protected override headers: Record<string, string> = {
		'User-Agent': 'fana-cumik/1.0',
		Accept: 'application/json'
	};

	private normalizeId(id: string): string {
		return id.replace(/^\/+/, '').replace(/^manga\//, '');
	}

	private coverUrl(mangaId: string, rels: MDRelationship[]): string {
		mangaId = this.normalizeId(mangaId);
		const cover = rels.find((r) => r.type === 'cover_art');
		if (!cover?.attributes?.fileName) return '';
		return `https://uploads.mangadex.org/covers/${mangaId}/${cover.attributes.fileName}.256.jpg`;
	}

	private titleStr(attrs: MDAttributes): string {
		return attrs.title['en'] || Object.values(attrs.title)[0] || '';
	}

	private toManga(item: MDItem): Manga {
		return {
			id: `/${item.id}`,
			title: this.titleStr(item.attributes),
			cover: this.coverUrl(item.id, item.relationships),
			sourceId: this.id
		};
	}

	async getLatestManga(page: number): Promise<Manga[]> {
		try {
			const offset = (page - 1) * 20;
			const url =
				`/manga?limit=20&offset=${offset}&order[updatedAt]=desc` +
				`&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`;
			const data = await this.fetchJson<MDResponse>(url);
			return (data.data || []).map((item) => this.toManga(item));
		} catch (e) {
			console.error('[MangaDex] getLatestManga failed:', e);
			return [];
		}
	}

	async searchManga(query: string, page = 1): Promise<Manga[]> {
		try {
			const offset = (page - 1) * 20;
			const url = `/manga?title=${encodeURIComponent(query)}&limit=20&offset=${offset}&includes[]=cover_art&contentRating[]=safe&contentRating[]=suggestive`;
			const data = await this.fetchJson<MDResponse>(url);
			return (data.data || []).map((item) => this.toManga(item));
		} catch (e) {
			console.error('[MangaDex] searchManga failed:', e);
			return [];
		}
	}

	async getMangaDetails(mangaId: string): Promise<MangaDetails> {
		mangaId = this.normalizeId(mangaId);
		const url = `/manga/${mangaId}?includes[]=cover_art&includes[]=author`;
		const data = await this.fetchJson<MDSingleResponse>(url);
		const item = data.data;
		const attrs = item.attributes;

		const authors = item.relationships
			.filter((r) => r.type === 'author')
			.map((r) => r.attributes?.name || '')
			.filter(Boolean);

		const genres = (attrs.tags || [])
			.map((t) => t.attributes?.name?.['en'] || '')
			.filter(Boolean);

		const description =
			attrs.description?.['en'] || Object.values(attrs.description || {})[0] || '';

		// Fetch chapter list - try EN + ID first, fallback to all languages
		const chapUrl =
			`/manga/${mangaId}/feed?translatedLanguage[]=en&translatedLanguage[]=id` +
			`&order[chapter]=desc&limit=100&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`;
		let chapters: Chapter[] = [];
		try {
			let chapData = await this.fetchJson<MDChapterResponse>(chapUrl);
			if (!chapData.data || chapData.data.length === 0) {
				const fallbackUrl = `/manga/${mangaId}/feed?order[chapter]=desc&limit=100&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`;
				chapData = await this.fetchJson<MDChapterResponse>(fallbackUrl);
			}

			chapters = (chapData.data || []).map((c) => {
				const num = parseFloat(c.attributes.chapter || '0') || 0;
				return {
					id: `/${mangaId}/chapter/${c.id}`,
					title: c.attributes.title || (c.attributes.chapter ? `Chapter ${num}` : 'Oneshot'),
					number: num,
					date: c.attributes.publishAt || ''
				};
			});
		} catch (e) {
			console.error('[MangaDex] chapters fetch failed:', e);
		}

		return {
			id: `/${mangaId}`,
			sourceId: this.id,
			title: this.titleStr(attrs),
			cover: this.coverUrl(mangaId, item.relationships),
			description,
			authors,
			status: attrs.status || 'ongoing',
			genres,
			chapters
		};
	}

	async getChapterPages(chapterId: string): Promise<string[]> {
		const id = this.normalizeId(chapterId).split('/').filter(Boolean).at(-1) || '';
		const data = await this.fetchJson<MDAtHomeResponse>(`/at-home/server/${id}?forcePort443=true`);
		const { baseUrl, chapter } = data;
		const files: string[] = chapter.data && chapter.data.length > 0 ? chapter.data : (chapter.dataSaver || []);
		const folder = chapter.data && chapter.data.length > 0 ? 'data' : 'data-saver';
		return files.map((fn: string) => `${baseUrl}/${folder}/${chapter.hash}/${fn}`);
	}
}
