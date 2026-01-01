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
            throw error(404, { message: 'Chapter not found or has no pages' });
        }

        // Extract current chapter info from chapter list
        const chapters = mangaDetails?.chapters || [];
        
        // Try exact match first, then loose match
        let currentChapterIndex = chapters.findIndex(ch => ch.id === chapterId);
        
        if (currentChapterIndex === -1 && chapters.length > 0) {
            // Fallback: match by ending (e.g. /chapter/1 vs /chapter-1 or missing prefix)
            currentChapterIndex = chapters.findIndex(ch => 
                ch.id.endsWith(chapterId) || chapterId.endsWith(ch.id)
            );
        }

        const currentChapter = chapters[currentChapterIndex] || null;
// Assumes Index 0 is Newest, Index N is Oldest
const nextChapter = currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null; // Moves towards 0
const prevChapter = currentChapterIndex < chapters.length - 1 ? chapters[currentChapterIndex + 1] : null; // Moves towards N

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
            chapters,
            currentChapter,
            prevChapter,
            nextChapter
        };
    } catch (e) {
        if (e && typeof e === 'object' && 'status' in e) throw e; // Re-throw SvelteKit errors
        debug.error(`Failed to fetch chapter ${chapterId} from ${source}:`, e);
        throw error(404, { message: 'Chapter not found' });
    }
};
