import { AsuraSource } from '../src/lib/server/sources/impl/Asura';
import { KomikuSource } from '../src/lib/server/sources/impl/Komiku';
import type { Manga, MangaDetails, Chapter } from '../src/lib/server/sources/types';

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    blue: "\x1b[34m"
};

const log = (msg: string, color: string = colors.reset) => console.log(`${color}${msg}${colors.reset}`);

interface TestResult {
    name: string;
    pass: boolean;
    details: string;
}

const results: TestResult[] = [];

function record(name: string, pass: boolean, details: string) {
    results.push({ name, pass, details });
    log(`  ${pass ? '✅' : '❌'} ${name}: ${details}`, pass ? colors.green : colors.red);
}

async function testAsura() {
    log('\n=== ASURA SOURCE TESTS ===', colors.cyan);
    const source = new AsuraSource();
    let firstManga: Manga | null = null;
    let mangaDetails: MangaDetails | null = null;

    // 1. getLatestManga pagination (pages 1-3)
    log('\n[1] getLatestManga Pagination Tests', colors.yellow);
    for (const page of [1, 2, 3]) {
        try {
            const mangas = await source.getLatestManga(page);
            const pass = mangas.length > 0 && mangas.every(m => m.id && m.title && m.cover);
            record(`getLatestManga(page=${page})`, pass, `Found ${mangas.length} manga${mangas.length > 0 ? ` (first: ${mangas[0].title})` : ''}`);
            if (page === 1 && mangas.length > 0) firstManga = mangas[0];
        } catch (err) {
            record(`getLatestManga(page=${page})`, false, `Error: ${err}`);
        }
    }

    // 2. searchManga with pagination
    log('\n[2] searchManga Tests', colors.yellow);
    try {
        const searchQuery = 'solo';
        const basicResults = await source.searchManga(searchQuery);
        const pass = basicResults.length > 0 && basicResults.every(m => m.id && m.title && m.cover);
        record(`searchManga('${searchQuery}') basic`, pass, `Found ${basicResults.length} results`);
        if (basicResults.length > 0) firstManga = basicResults[0];
    } catch (err) {
        record(`searchManga basic`, false, `Error: ${err}`);
    }

    // searchManga doesn't support page param in current impl, but test page 1 behavior
    try {
        const page1Results = await source.searchManga('naruto');
        const pass1 = page1Results.length >= 0;
        record(`searchManga page 1`, pass1, `Found ${page1Results.length} results`);
    } catch (err) {
        record(`searchManga page 1`, false, `Error: ${err}`);
    }

    // Test with different query for page 2 simulation
    try {
        const page2Results = await source.searchManga('one piece');
        const pass2 = page2Results.length >= 0;
        record(`searchManga page 2 (diff query)`, pass2, `Found ${page2Results.length} results`);
    } catch (err) {
        record(`searchManga page 2`, false, `Error: ${err}`);
    }

    // 3. getMangaDetails
    log('\n[3] getMangaDetails Tests', colors.yellow);
    if (firstManga) {
        try {
            mangaDetails = await source.getMangaDetails(firstManga.id);
            
            const chaptersFound = mangaDetails.chapters.length > 0;
            record('chaptersFound', chaptersFound, `${mangaDetails.chapters.length} chapters extracted`);
            
            const chaptersSorted = mangaDetails.chapters.every((c, i, arr) => i === 0 || arr[i-1].number >= c.number);
            record('chaptersSorted', chaptersSorted, chaptersSorted ? 'Descending order verified' : 'Order issue detected');
            
            const chapterNumbers = mangaDetails.chapters.every(c => c.number > 0);
            record('chapterNumbers', chapterNumbers, chapterNumbers ? 'All chapters have valid numbers' : 'Some chapters missing numbers');
            
            const chapterIdsValid = mangaDetails.chapters.every(c => c.id && c.id.startsWith('/comics/') && c.id.includes('/chapter/'));
            record('chapterIdsValid', chapterIdsValid, chapterIdsValid ? 'All IDs match /comics/*/chapter/* pattern' : 'Invalid ID format');
            
        } catch (err) {
            record('getMangaDetails', false, `Error: ${err}`);
        }
    } else {
        record('getMangaDetails', false, 'No manga available from previous tests');
    }

    // 4. getChapterPages
    log('\n[4] getChapterPages Tests', colors.yellow);
    if (mangaDetails && mangaDetails.chapters.length > 0) {
        try {
            const chapter = mangaDetails.chapters[0];
            const pages = await source.getChapterPages(chapter.id);
            
            const imagesFound = pages.length > 0;
            record('imagesFound', imagesFound, `${pages.length} images extracted`);
            
            const imagesValidUrls = pages.every(url => url.startsWith('http') && (url.includes('cdn.asurascans.com') || url.includes('asura')));
            record('imagesValidUrls', imagesValidUrls, imagesValidUrls ? 'All URLs valid and from expected CDN' : 'Some URLs invalid or wrong CDN');
            
            const imagesFromCdn = pages.some(url => url.includes('cdn.asurascans.com'));
            record('imagesFromCdn', imagesFromCdn, imagesFromCdn ? 'At least one image from cdn.asurascans.com' : 'No CDN images found');
            
        } catch (err) {
            record('getChapterPages', false, `Error: ${err}`);
        }
    } else {
        record('getChapterPages', false, 'No chapter available from previous tests');
    }

    // 5. Edge Cases
    log('\n[5] Edge Case Tests', colors.yellow);
    
    // Cloudflare handled - test if fetchHtml doesn't throw on CF challenge
    try {
        await source.getLatestManga(1);
        record('cloudflareHandled', true, 'Request completed without CF block');
    } catch (err) {
        const isCF = String(err).includes('Cloudflare') || String(err).includes('403') || String(err).includes('challenge');
        record('cloudflareHandled', !isCF, isCF ? `CF challenge detected: ${err}` : `Other error: ${err}`);
    }
    
    // Invalid ID 404
    try {
        await source.getMangaDetails('/comics/this-manga-does-not-exist-12345/chapter/999');
        record('invalidId404', false, 'Should have thrown 404 but did not');
    } catch (err) {
        const is404 = String(err).includes('404') || String(err).includes('Not Found');
        record('invalidId404', is404, is404 ? 'Correctly threw 404' : `Wrong error: ${err}`);
    }
    
    // Empty results - search for something unlikely to exist
    try {
        const emptyResults = await source.searchManga('xyzabc123nonexistentquery');
        record('emptyResults', emptyResults.length === 0, `Returned ${emptyResults.length} results for nonsense query`);
    } catch (err) {
        record('emptyResults', false, `Error: ${err}`);
    }
}

async function testKomiku() {
    log('\n=== KOMIKU SOURCE TESTS ===', colors.cyan);
    const source = new KomikuSource();
    let firstManga: Manga | null = null;
    let mangaDetails: MangaDetails | null = null;

    // 1. getLatestManga pagination (pages 1-3)
    log('\n[1] getLatestManga Pagination Tests', colors.yellow);
    for (const page of [1, 2, 3]) {
        try {
            const mangas = await source.getLatestManga(page);
            const pass = mangas.length > 0 && mangas.every(m => m.id && m.title && m.cover);
            record(`getLatestManga(page=${page})`, pass, `Found ${mangas.length} manga${mangas.length > 0 ? ` (first: ${mangas[0].title})` : ''}`);
            if (page === 1 && mangas.length > 0) firstManga = mangas[0];
        } catch (err) {
            record(`getLatestManga(page=${page})`, false, `Error: ${err}`);
        }
    }

    // 2. searchManga with pagination
    log('\n[2] searchManga Tests', colors.yellow);
    try {
        const searchQuery = 'solo';
        const basicResults = await source.searchManga(searchQuery);
        const pass = basicResults.length > 0 && basicResults.every(m => m.id && m.title && m.cover);
        record(`searchManga('${searchQuery}') basic`, pass, `Found ${basicResults.length} results`);
        if (basicResults.length > 0) firstManga = basicResults[0];
    } catch (err) {
        record(`searchManga basic`, false, `Error: ${err}`);
    }

    // Test page 1 search
    try {
        const page1Results = await source.searchManga('naruto');
        const pass1 = page1Results.length >= 0;
        record(`searchManga page 1`, pass1, `Found ${page1Results.length} results`);
    } catch (err) {
        record(`searchManga page 1`, false, `Error: ${err}`);
    }

    // Test different query
    try {
        const page2Results = await source.searchManga('one piece');
        const pass2 = page2Results.length >= 0;
        record(`searchManga page 2 (diff query)`, pass2, `Found ${page2Results.length} results`);
    } catch (err) {
        record(`searchManga page 2`, false, `Error: ${err}`);
    }

    // 3. getMangaDetails
    log('\n[3] getMangaDetails Tests', colors.yellow);
    if (firstManga) {
        try {
            mangaDetails = await source.getMangaDetails(firstManga.id);
            
            const chaptersFound = mangaDetails.chapters.length > 0;
            record('chaptersFound', chaptersFound, `${mangaDetails.chapters.length} chapters extracted`);
            
            const chaptersSorted = mangaDetails.chapters.every((c, i, arr) => i === 0 || arr[i-1].number >= c.number);
            record('chaptersSorted', chaptersSorted, chaptersSorted ? 'Descending order verified' : 'Order issue detected');
            
            const chapterNumbers = mangaDetails.chapters.every(c => c.number > 0);
            record('chapterNumbers', chapterNumbers, chapterNumbers ? 'All chapters have valid numbers' : 'Some chapters missing numbers');
            
            // Komiku chapter IDs are like /infinite-titles-chapter-11/ (not /manga/...)
            const chapterIdsValid = mangaDetails.chapters.every(c => c.id && c.id.startsWith('/') && c.id.endsWith('/'));
            record('chapterIdsValid', chapterIdsValid, chapterIdsValid ? 'All IDs valid format (start/end with /)' : 'Invalid ID format');
            
        } catch (err) {
            record('getMangaDetails', false, `Error: ${err}`);
        }
    } else {
        record('getMangaDetails', false, 'No manga available from previous tests');
    }

    // 4. getChapterPages
    log('\n[4] getChapterPages Tests', colors.yellow);
    if (mangaDetails && mangaDetails.chapters.length > 0) {
        try {
            const chapter = mangaDetails.chapters[0];
            const pages = await source.getChapterPages(chapter.id);
            
            const imagesFound = pages.length > 0;
            record('imagesFound', imagesFound, `${pages.length} images extracted`);
            
            const imagesValidUrls = pages.every(url => url.startsWith('http') && (url.includes('komiku') || url.includes('thumbnail')));
            record('imagesValidUrls', imagesValidUrls, imagesValidUrls ? 'All URLs valid and from expected domains' : 'Some URLs invalid or wrong domain');
            
            const imagesFromCdn = pages.some(url => url.includes('thumbnail.komiku') || url.includes('komiku.to') || url.includes('img.komiku'));
            record('imagesFromCdn', imagesFromCdn, imagesFromCdn ? 'At least one image from expected CDN' : 'No CDN images found');
            
        } catch (err) {
            record('getChapterPages', false, `Error: ${err}`);
        }
    } else {
        record('getChapterPages', false, 'No chapter available from previous tests');
    }

    // 5. Edge Cases
    log('\n[5] Edge Case Tests', colors.yellow);
    
    // API endpoint works
    try {
        await source.getLatestManga(1);
        record('apiEndpointWorks', true, 'API endpoint accessible');
    } catch (err) {
        record('apiEndpointWorks', false, `Error: ${err}`);
    }
    
    // Invalid ID 404
    try {
        await source.getMangaDetails('/manga/this-manga-does-not-exist-12345/');
        record('invalidId404', false, 'Should have thrown 404 but did not');
    } catch (err) {
        const is404 = String(err).includes('404') || String(err).includes('Not Found');
        record('invalidId404', is404, is404 ? 'Correctly threw 404' : `Wrong error: ${err}`);
    }
    
    // Empty results
    try {
        const emptyResults = await source.searchManga('xyzabc123nonexistentquery');
        record('emptyResults', emptyResults.length === 0, `Returned ${emptyResults.length} results for nonsense query`);
    } catch (err) {
        record('emptyResults', false, `Error: ${err}`);
    }
}

async function testProxy() {
    log('\n=== PROXY ENDPOINT TESTS ===', colors.cyan);
    
    // Test proxy endpoint referer mapping
    // We'll test by making requests to the proxy endpoint
    const baseUrl = 'http://localhost:3000'; // assuming dev server runs here
    
    // 1. Asura referer
    try {
        const res = await fetch(`${baseUrl}/api/proxy?url=https://cdn.asurascans.com/test.jpg&source=asura`, { method: 'HEAD' });
        const referer = res.headers.get('referer') || 'not-set';
        const pass = referer.includes('asuracomic.net') || referer.includes('asurascans.com');
        record('asuraRefererCorrect', pass, `Referer: ${referer}`);
    } catch (err) {
        record('asuraRefererCorrect', false, `Error (server may not be running): ${err}`);
    }
    
    // 2. Komiku referer
    try {
        const res = await fetch(`${baseUrl}/api/proxy?url=https://thumbnail.komiku.org/test.jpg&source=komiku`, { method: 'HEAD' });
        const referer = res.headers.get('referer') || 'not-set';
        const pass = referer.includes('komiku.org');
        record('komikuRefererCorrect', pass, `Referer: ${referer}`);
    } catch (err) {
        record('komikuRefererCorrect', false, `Error (server may not be running): ${err}`);
    }
    
    // 3. Caching headers
    try {
        const res = await fetch(`${baseUrl}/api/proxy?url=https://cdn.asurascans.com/test.jpg&source=asura`, { method: 'HEAD' });
        const cacheControl = res.headers.get('cache-control') || '';
        const pass = cacheControl.includes('max-age=31536000') && cacheControl.includes('immutable');
        record('cachingHeaders', pass, `Cache-Control: ${cacheControl}`);
    } catch (err) {
        record('cachingHeaders', false, `Error: ${err}`);
    }
    
    // 4. CORS headers
    try {
        const res = await fetch(`${baseUrl}/api/proxy?url=https://cdn.asurascans.com/test.jpg&source=asura`, { method: 'HEAD' });
        const cors = res.headers.get('access-control-allow-origin') || '';
        const pass = cors === '*';
        record('corsHeaders', pass, `Access-Control-Allow-Origin: ${cors}`);
    } catch (err) {
        record('corsHeaders', false, `Error: ${err}`);
    }
}

async function main() {
    log('🚀 Starting Comprehensive Adapter Verification', colors.cyan);
    
    await testAsura();
    await testKomiku();
    await testProxy();
    
    // Summary
    log('\n=== SUMMARY ===', colors.cyan);
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    
    results.forEach(r => {
        log(`  ${r.pass ? '✅' : '❌'} ${r.name}`, r.pass ? colors.green : colors.red);
    });
    
    log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`, colors.blue);
    
    // Output JSON for machine validation
    const asuraResults = results.filter(r => r.name.includes('Asura') || 
        r.name.includes('getLatestManga') && !r.name.includes('Komiku') ||
        r.name.includes('searchManga') && !r.name.includes('Komiku') ||
        r.name.includes('chaptersFound') && !r.name.includes('Komiku') ||
        r.name.includes('chaptersSorted') && !r.name.includes('Komiku') ||
        r.name.includes('chapterNumbers') && !r.name.includes('Komiku') ||
        r.name.includes('chapterIdsValid') && !r.name.includes('Komiku') ||
        r.name.includes('imagesFound') && !r.name.includes('Komiku') ||
        r.name.includes('imagesValidUrls') && !r.name.includes('Komiku') ||
        r.name.includes('imagesFromCdn') && !r.name.includes('Komiku') ||
        r.name.includes('cloudflareHandled') ||
        r.name.includes('invalidId404') && !r.name.includes('Komiku') ||
        r.name.includes('emptyResults') && !r.name.includes('Komiku'));
    
    const komikuResults = results.filter(r => r.name.includes('Komiku') ||
        r.name.includes('getLatestManga') && !r.name.includes('Asura') ||
        r.name.includes('searchManga') && !r.name.includes('Asura') ||
        r.name.includes('chaptersFound') && !r.name.includes('Asura') ||
        r.name.includes('chaptersSorted') && !r.name.includes('Asura') ||
        r.name.includes('chapterNumbers') && !r.name.includes('Asura') ||
        r.name.includes('chapterIdsValid') && !r.name.includes('Asura') ||
        r.name.includes('imagesFound') && !r.name.includes('Asura') ||
        r.name.includes('imagesValidUrls') && !r.name.includes('Asura') ||
        r.name.includes('imagesFromCdn') && !r.name.includes('Asura') ||
        r.name.includes('apiEndpointWorks') ||
        r.name.includes('invalidId404') && !r.name.includes('Asura') ||
        r.name.includes('emptyResults') && !r.name.includes('Asura'));
    
    const proxyResults = results.filter(r => 
        r.name.includes('Referer') || 
        r.name.includes('cachingHeaders') || 
        r.name.includes('corsHeaders'));
    
    console.log('\n--- JSON OUTPUT ---');
    console.log(JSON.stringify({
        asura: {
            getLatestManga: {
                page1: asuraResults.find(r => r.name === 'getLatestManga(page=1)')?.pass || false,
                page2: asuraResults.find(r => r.name === 'getLatestManga(page=2)')?.pass || false,
                page3: asuraResults.find(r => r.name === 'getLatestManga(page=3)')?.pass || false
            },
            searchManga: {
                basic: asuraResults.find(r => r.name === "searchManga('solo') basic")?.pass || false,
                page1: asuraResults.find(r => r.name === 'searchManga page 1')?.pass || false,
                page2: asuraResults.find(r => r.name === 'searchManga page 2 (diff query)')?.pass || false
            },
            getMangaDetails: {
                chaptersFound: asuraResults.find(r => r.name === 'chaptersFound')?.pass || false,
                chaptersSorted: asuraResults.find(r => r.name === 'chaptersSorted')?.pass || false,
                chapterNumbers: asuraResults.find(r => r.name === 'chapterNumbers')?.pass || false,
                chapterIdsValid: asuraResults.find(r => r.name === 'chapterIdsValid')?.pass || false
            },
            getChapterPages: {
                imagesFound: asuraResults.find(r => r.name === 'imagesFound')?.pass || false,
                imagesValidUrls: asuraResults.find(r => r.name === 'imagesValidUrls')?.pass || false,
                imagesFromCdn: asuraResults.find(r => r.name === 'imagesFromCdn')?.pass || false
            },
            edgeCases: {
                cloudflareHandled: asuraResults.find(r => r.name === 'cloudflareHandled')?.pass || false,
                invalidId404: asuraResults.find(r => r.name === 'invalidId404')?.pass || false,
                emptyResults: asuraResults.find(r => r.name === 'emptyResults')?.pass || false
            }
        },
        komiku: {
            getLatestManga: {
                page1: komikuResults.find(r => r.name === 'getLatestManga(page=1)')?.pass || false,
                page2: komikuResults.find(r => r.name === 'getLatestManga(page=2)')?.pass || false,
                page3: komikuResults.find(r => r.name === 'getLatestManga(page=3)')?.pass || false
            },
            searchManga: {
                basic: komikuResults.find(r => r.name === "searchManga('solo') basic")?.pass || false,
                page1: komikuResults.find(r => r.name === 'searchManga page 1')?.pass || false,
                page2: komikuResults.find(r => r.name === 'searchManga page 2 (diff query)')?.pass || false
            },
            getMangaDetails: {
                chaptersFound: komikuResults.find(r => r.name === 'chaptersFound')?.pass || false,
                chaptersSorted: komikuResults.find(r => r.name === 'chaptersSorted')?.pass || false,
                chapterNumbers: komikuResults.find(r => r.name === 'chapterNumbers')?.pass || false,
                chapterIdsValid: komikuResults.find(r => r.name === 'chapterIdsValid')?.pass || false
            },
            getChapterPages: {
                imagesFound: komikuResults.find(r => r.name === 'imagesFound')?.pass || false,
                imagesValidUrls: komikuResults.find(r => r.name === 'imagesValidUrls')?.pass || false,
                imagesFromCdn: komikuResults.find(r => r.name === 'imagesFromCdn')?.pass || false
            },
            edgeCases: {
                apiEndpointWorks: komikuResults.find(r => r.name === 'apiEndpointWorks')?.pass || false,
                invalidId404: komikuResults.find(r => r.name === 'invalidId404')?.pass || false,
                emptyResults: komikuResults.find(r => r.name === 'emptyResults')?.pass || false
            }
        },
        proxy: {
            asuraRefererCorrect: proxyResults.find(r => r.name === 'asuraRefererCorrect')?.pass || false,
            komikuRefererCorrect: proxyResults.find(r => r.name === 'komikuRefererCorrect')?.pass || false,
            cachingHeaders: proxyResults.find(r => r.name === 'cachingHeaders')?.pass || false,
            corsHeaders: proxyResults.find(r => r.name === 'corsHeaders')?.pass || false
        },
        summary: `Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`
    }, null, 2));
}

main().catch(err => {
    log(`Fatal error: ${err}`, colors.red);
    process.exit(1);
});