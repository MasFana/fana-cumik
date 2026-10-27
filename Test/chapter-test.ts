import { KomikuSource } from '../src/lib/server/sources/impl/Komiku';

const source = new KomikuSource();
const pages = await source.getChapterPages('/infinite-titles-chapter-20/');
console.log('Pages:', pages.length);
console.log('First 3:', pages.slice(0, 3));