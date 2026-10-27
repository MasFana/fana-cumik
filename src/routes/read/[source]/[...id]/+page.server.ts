/**
 * Chapter Reader Page - Server Load Function
 *
 * Fetches all page images for a specific chapter.
 * Also fetches manga metadata for history tracking and chapter navigation.
 * Implements aggressive caching since chapter content rarely changes.
 */

import { getSource } from '$lib/server/sources';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import debug from '$lib/utils/debug';


export const load: PageServerLoad = async ({ params, setHeaders }) => {
    const { source, id } = params;

    	// The [...id] catch-all gives us the full path, reconstruct with leading slash
	const chapterId = `/${id}`;
	
	// Remove the chapter part from the ID to get the manga ID
	const mangaId = chapterId.replace(/\/(chapter|ch|episode|ep)[-/_]?.+$/i, '');
    // For History
    const mangaSlug = mangaId.startsWith('/') ? mangaId.slice(1): mangaId;

    try {
        const adapter = getSource(source);
        
        // Fetch chapter pages and manga details in parallel
        const [pages, mangaDetails] = await Promise.all([
            adapter.getChapterPages(chapterId),
            adapter.getMangaDetails(mangaId).catch((e) => {
                debug.error(`[Reader] Failed to fetch manga details:`, e);
                return null;
            })
        ]);
        
        if (!pages || pages.length === 0) {
            // Return empty pages with error flag instead of throwing 404
            return {
                pages: [],
                source,
                chapterId,
                mangaInfo: mangaDetails ? {
                    id: mangaDetails.id,
                    title: mangaDetails.title,
                    cover: mangaDetails.cover,
                    slug: mangaSlug
                } : {
                    id: mangaId,
                    title: mangaSlug.replace(/-/g, ' '),
                    cover: '',
                    slug: mangaSlug
                },
                chapters: mangaDetails?.chapters || [],
                currentChapter: null,
                prevChapter: null,
                nextChapter: null,
                error: 'Chapter not found or has no pages'
            };
        }

        // Extract current chapter info from chapter list
        		const chapters = mangaDetails?.chapters || [];
		
        		// Parse chapter titles to separate title from date for ALL chapters
        				const parsedChapters = chapters.map(ch => {
        					let title = ch.title || '';
        					let date = ch.date || '';
			
        					// If date field exists and title ends with date, remove date from title
        					if (date && title.endsWith(date)) {
        						title = title.slice(0, -date.length).trim();
        					} else {
        						// Fallback: regex parse
        						const match = title.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i);
        						if (match) {
        							title = match[1].trim();
        							date = match[2].trim() || date;
        						}
        					}
        					return { ...ch, title, date };
        				});
		
        		// Try exact match first, then loose match
        		let currentChapterIndex = parsedChapters.findIndex(ch => ch.id === chapterId);
        
        if (currentChapterIndex === -1 && parsedChapters.length > 0) {
            // Fallback: match by ending (e.g. /chapter/1 vs /chapter-1 or missing prefix)
            currentChapterIndex = parsedChapters.findIndex(ch => 
                ch.id.endsWith(chapterId) || chapterId.endsWith(ch.id)
            );
        }

        const currentChapter = parsedChapters[currentChapterIndex] || null;
        
        // Parse chapter title to separate chapter number/title from date
        // Title format: "Chapter 17716 hours ago" or "Chapter 177Sep 21, 2026"
        let parsedChapterTitle = currentChapter?.title || '';
        let chapterDate = '';
        if (parsedChapterTitle) {
            // Match patterns like "Chapter 17716 hours ago" or "Chapter 177Sep 21, 2026"
            const match = parsedChapterTitle.match(/^(Chapter\s+\d+(?:\.\d+)?)(.+)$/i);
            if (match) {
                parsedChapterTitle = match[1].trim();
                chapterDate = match[2].trim();
            }
        }
        
// Assumes Index 0 is Newest, Index N is Oldest
const nextChapter = currentChapterIndex > 0 ? parsedChapters[currentChapterIndex - 1] : null; // Moves towards 0
const prevChapter = currentChapterIndex < parsedChapters.length - 1 ? parsedChapters[currentChapterIndex + 1] : null; // Moves towards N

        // Caching Strategy:
        // Chapter content rarely changes, so we can cache longer
        // - Browser cache: 1 hour
        // - CDN cache: 24 hours
        setHeaders({
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=300'
        });

        return {
            pages,
            source,
            chapterId,
            mangaInfo: mangaDetails ? {
                id: mangaDetails.id,
                title: mangaDetails.title,
                cover: mangaDetails.cover,
                slug: mangaSlug
            } : {
                id: mangaId,
                title: mangaSlug.replace(/-/g, ' '),
                cover: '',
                slug: mangaSlug
            },
            chapters: parsedChapters,
            currentChapter: currentChapter ? {
                ...currentChapter,
                title: parsedChapterTitle,
                date: chapterDate
            } : null,
            prevChapter,
            nextChapter
        };
    } catch (e) {
        if (e && typeof e === 'object' && 'status' in e) throw e; // Re-throw SvelteKit errors
        debug.error(`Failed to fetch chapter ${chapterId} from ${source}:`, e);
        throw error(404, { message: 'Chapter not found' });
    }
};
