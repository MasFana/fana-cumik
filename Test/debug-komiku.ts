import { KomikuSource } from '../src/lib/server/sources/impl/Komiku';

const source = new KomikuSource();
const latest = await source.getLatestManga(1);
console.log('First manga:', latest[0]);
const details = await source.getMangaDetails(latest[0].id);
console.log('Chapters (first 3):', details.chapters.slice(0, 3).map(c => ({id: c.id, number: c.number, title: c.title})));
console.log('All IDs end with /:', details.chapters.every(c => c.id.endsWith('/')));
console.log('All IDs start with /manga/:', details.chapters.every(c => c.id.startsWith('/manga/')));