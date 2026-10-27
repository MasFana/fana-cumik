import { KomikuSource } from '../src/lib/server/sources/impl/Komiku';

const source = new KomikuSource();

// Get latest manga
const latest = await source.getLatestManga(1);
console.log('Latest manga count:', latest.length);
console.log('First 5:', latest.slice(0, 5).map(m => ({id: m.id, title: m.title})));

// Test getting details for the first one
if (latest.length > 0) {
    const manga = latest[0];
    console.log('\nTesting details for:', manga.id);
    try {
        const details = await source.getMangaDetails(manga.id);
        console.log('Title:', details.title);
        console.log('Chapters:', details.chapters.length);
        console.log('First 5 chapters:', details.chapters.slice(0, 5).map(c => ({id: c.id, number: c.number, title: c.title})));
        
        // Test chapter pages for the last chapter (chapter 1)
        const chapter1 = details.chapters[details.chapters.length - 1];
        console.log('\nTesting chapter pages for:', chapter1.id);
        const pages = await source.getChapterPages(chapter1.id);
        console.log('Pages count:', pages.length);
    } catch (e) {
        console.error('Error:', e);
    }
}