import type { IMangaSource, Manga, MangaDetails } from './types';

/**
 * Abstract base class for all manga source adapters.
 * Provides shared functionality like HTTP fetching with proper headers.
 */
export abstract class BaseSource implements IMangaSource {
	abstract id: string;
	abstract name: string;
	abstract baseUrl: string;

	/**
	 * Default headers to avoid bot detection.
	 * Most manga sites block requests without a proper User-Agent.
	 */
	protected headers: Record<string, string> = {
		'User-Agent':
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
		Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
		'Accept-Language': 'en-US,en;q=0.5'
	};

	/**
	 * Fetch HTML content from the source with proper headers.
	 * @param path - URL path to append to baseUrl
	 * @returns HTML string
	 */
	protected async fetchHtml(path: string): Promise<string> {
		const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

		const response = await fetch(url, {
			headers: {
				...this.headers,
				Referer: this.baseUrl
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
		}

		return await response.text();
	}

	/**
	 * Fetch JSON data from the source (for sites with API endpoints).
	 * @param path - URL path to append to baseUrl
	 * @returns Parsed JSON
	 */
	protected async fetchJson<T>(path: string): Promise<T> {
		const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

		const response = await fetch(url, {
			headers: {
				...this.headers,
				Referer: this.baseUrl,
				Accept: 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
		}

		return await response.json();
	}

	// --- small HTML readers -------------------------------------------------
	// These replace cheerio in the adapters: no tree, no dependency. They read the
	// shapes these five sites actually emit (quoted attributes, no `>` inside one,
	// standard entities). A shape outside that needs a real parser again.

	/**
	 * Split HTML at every marker match (one pass), for repeated records such as
	 * chapter rows. `before` is the 600 characters ahead of the match: the context
	 * a DOM ancestor would see. `body` runs to the next match, so a capture in one
	 * record can never bleed into the next. `at` is the match offset in `html`.
	 */
	protected static records(
		html: string,
		marker: RegExp,
		context = 600
	): { before: string; body: string; at: number }[] {
		const re = new RegExp(
			marker.source,
			marker.flags.includes('g') ? marker.flags : `${marker.flags}g`
		);
		const at: number[] = [];
		for (const m of html.matchAll(re)) at.push(m.index);
		return at.map((start, i) => ({
			before: html.slice(Math.max(0, start - context), start),
			body: html.slice(start, i + 1 < at.length ? at[i + 1] : html.length),
			at: start
		}));
	}

	/** Value of one attribute inside a single tag string, quoted or not (entities decoded). */
	protected static attr(tag: string, name: string): string {
		if (!tag) return '';
		const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>"'=]+))`, 'i');
		const m = tag.match(re);
		return m ? BaseSource.decode(m[1] ?? m[2] ?? m[3] ?? '') : '';
	}

	/** First tag matching `tagRe`, as the raw tag string, for BaseSource.attr(). */
	protected static tag(html: string, tagRe: RegExp): string {
		return html.match(tagRe)?.[0] || '';
	}

	/** Every tag matching `tagRe` in document order. */
	protected static tags(html: string, tagRe: RegExp): string[] {
		const re = new RegExp(
			tagRe.source,
			tagRe.flags.includes('g') ? tagRe.flags : `${tagRe.flags}g`
		);
		return Array.from(html.matchAll(re), (m) => m[0]);
	}

	/** The opening tag that starts `body` (a record from BaseSource.records). */
	protected static open(body: string): string {
		const gt = body.indexOf('>');
		return gt < 0 ? body : body.slice(0, gt + 1);
	}

	/**
	 * Content of the tag that starts `body`, up to its first `</tagName>`. Nested
	 * elements of the same name need a sibling pass instead.
	 */
	protected static inner(body: string, tagName: string): string {
		const gt = body.indexOf('>');
		const end = body.search(new RegExp(`</${tagName}\\b`, 'i'));
		return body.slice(gt + 1, end < 0 ? body.length : end);
	}

	/**
	 * The element that contains offset `at`, up to its own close tag. Nested
	 * same-name tags are counted, so the region never runs past the element.
	 */
	protected static elementAt(html: string, at: number): string {
		if (at < 0) return '';
		const open = html.lastIndexOf('<', at);
		const tagName = html.slice(open + 1).match(/^[a-z][a-z0-9]*/i)?.[0];
		if (!tagName) return '';
		const re = new RegExp(`<${tagName}\\b|</${tagName}\\b`, 'gi');
		let depth = 0;
		for (const m of html.matchAll(re)) {
			if (m.index < open) continue;
			depth += m[0][1] === '/' ? -1 : 1;
			if (depth === 0) {
				const rest = html.slice(m.index);
				const end = rest.indexOf('>');
				return html.slice(open, m.index + (end < 0 ? rest.length : end + 1));
			}
		}
		return html.slice(open);
	}

	/**
	 * Visible text, as cheerio's `.text()`: tags gone (no separator, the DOM joins
	 * text nodes as they are), entities decoded, ends trimmed. Inner spaces and
	 * line breaks stay — collapse them at the call site when a field is one line.
	 */
	protected static text(html: string): string {
		if (!html) return '';
		return BaseSource.decode(html.replace(/<[^>]*>/g, '')).trim();
	}

	/**
	 * The first element whose own tag carries `name="value"`, as raw HTML up to its
	 * own close tag. For schema.org hooks such as `itemprop="url"`.
	 */
	protected static element(html: string, name: string, value: string): string {
		const esc = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const re = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\b${name}\\s*=\\s*"${esc}"[^>]*>`, 'i');
		const m = re.exec(html);
		if (!m) return '';
		if (/^(meta|img|input|link|br|hr|source|area|embed|track|wbr)$/i.test(m[1])) return m[0];
		const rest = html.slice(m.index + m[0].length);
		const end = rest.search(new RegExp(`</${m[1]}\\b`, 'i'));
		return m[0] + (end < 0 ? rest : rest.slice(0, end));
	}

	/** The entities these sites emit. The full HTML table is a real parser's job. */
	protected static decode(s: string): string {
		if (!s || !s.includes('&')) return s;
		const named: Record<string, string> = {
			amp: '&',
			lt: '<',
			gt: '>',
			quot: '"',
			apos: "'",
			nbsp: ' ',
			mdash: '—',
			ndash: '–',
			hellip: '…',
			rsquo: '’',
			lsquo: '‘',
			rdquo: '”',
			ldquo: '“',
			deg: '°',
			middot: '·'
		};
		return s.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, body: string) => {
			if (body[0] !== '#') return named[body.toLowerCase()] ?? whole;
			const code =
				body[1] === 'x' || body[1] === 'X'
					? parseInt(body.slice(2), 16)
					: parseInt(body.slice(1), 10);
			return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
		});
	}

	// Abstract methods to be implemented by concrete adapters
	abstract getLatestManga(page: number): Promise<Manga[]>;
	abstract searchManga(query: string): Promise<Manga[]>;
	abstract getMangaDetails(mangaId: string): Promise<MangaDetails>;
	abstract getChapterPages(chapterId: string): Promise<string[]>;
}
