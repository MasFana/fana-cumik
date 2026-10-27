import { KomikuSource } from '../src/lib/server/sources/impl/Komiku';

const source = new KomikuSource();

// Search for "The Novel's Extra"
const search = await source.searchManga("The Novel's Extra");
console.log('Search results:', search);

if (search.length > 0) {
    const manga = search[0];
    console.log('\nManga ID:', manga.id);
    const details = await source.getMangaDetails(manga.id);
    console.log('Title:', details.title);
    console.log('Chapters count:', details.chapters.length);
    console.log('First 5 chapters:', details.chapters.slice(0, 5).map(c => ({id: c.id, number: c.number, title: c.title})));
    
    // Test getting chapter pages for first chapter
    if (details.chapters.length > 0) {
        const firstChapter = details.chapters[details.chapters.length - 1]; // oldest = chapter 1
        console.log('\nTesting chapter:', firstChapter.id);
        const pages = await source.getChapterPages(firstChapter.id);
        console.log('Pages count:', pages.length);
    }
}