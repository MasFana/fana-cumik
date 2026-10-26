import { KomikuSource } from '../src/lib/server/sources/impl/Komiku';
import type { Manga, MangaDetails } from '../src/lib/server/sources/types';

const Impl = KomikuSource;

// specific colors for console output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m"
};

const log = (msg: string, color: string = colors.reset) => console.log(`${color}${msg}${colors.reset}`);

async function runTest() {
    log("🚀 Starting Adapter Test...\n", colors.cyan);

    const source = new Impl();
    let selectedManga: Manga | null = null;
    let selectedDetails: MangaDetails | null = null;

    // ---------------------------------------------------------
    // 1. Test getLatestManga
    // ---------------------------------------------------------
    try {
        log(`[1] Testing getLatestManga(1)...`, colors.yellow);
        const latest = await source.getLatestManga(1);

        if (latest.length > 0) {
            log(`    ✅ Success: Found ${latest.length} manga entries.`, colors.green);
            log(`    ℹ️  First item: ${latest[0].title} (ID: ${latest[0].id})`);
            selectedManga = latest[0];
        } else {
            log(`    ❌ Failed: Returned empty array.`, colors.red);
            process.exit(1);
        }
    } catch (err) {
        log(`    ❌ Error: ${err}`, colors.red);
        process.exit(1);
    }

    console.log("");

    // ---------------------------------------------------------
    // 2. Test searchManga
    // ---------------------------------------------------------
    try {
        const query = selectedManga ? selectedManga.title.substring(0, 10) : "Ao Ashi";
        log(`[2] Testing searchManga('${query}')...`, colors.yellow);

        const searchResults = await source.searchManga(query);

        if (searchResults.length > 0) {
            log(`    ✅ Success: Found ${searchResults.length} search results.`, colors.green);
            const match = searchResults[0];
            log(`    ℹ️  Top result: ${match.title} (ID: ${match.id})`);
        } else {
            log(`    ⚠️  Warning: Search returned 0 results (This might be valid depending on query).`, colors.yellow);
        }
    } catch (err) {
        log(`    ❌ Error: ${err}`, colors.red);
    }

    console.log("");

    // ---------------------------------------------------------
    // 3. Test getMangaDetails
    // ---------------------------------------------------------
    if (!selectedManga) return;

    try {
        log(`[3] Testing getMangaDetails('${selectedManga.id}')...`, colors.yellow);
        selectedDetails = await source.getMangaDetails(selectedManga.id);

        if (selectedDetails.chapters.length > 0) {
            log(`    ✅ Success: Retrieved details.`, colors.green);
            log(`    ℹ️  Title: ${selectedDetails.title}`);
            log(`    ℹ️  Chapters: ${selectedDetails.chapters.length} found.`);
            log(`    ℹ️  Latest Chapter: ${selectedDetails.chapters[0].title} (ID: ${selectedDetails.chapters[0].id})`);
        } else {
            log(`    ❌ Failed: Details loaded but no chapters found. Parsing issue?`, colors.red);
            process.exit(1);
        }
    } catch (err) {
        log(`    ❌ Error: ${err}`, colors.red);
        process.exit(1);
    }

    console.log("");

    // ---------------------------------------------------------
    // 4. Test getChapterPages
    // ---------------------------------------------------------
    if (!selectedDetails || selectedDetails.chapters.length === 0) return;

    try {
        const targetChapter = selectedDetails.chapters[0];
        log(`[4] Testing getChapterPages('${targetChapter.id}')...`, colors.yellow);

        const pages = await source.getChapterPages(targetChapter.id);

        if (pages.length > 0) {
            log(`    ✅ Success: Found ${pages.length} pages.`, colors.green);
            log(`    ℹ️  Sample Page 1: ${pages[0]}`);

            if (!pages[0].startsWith('http')) {
                log(`    ⚠️  Warning: Image URL does not start with http.`, colors.yellow);
            }
        } else {
            log(`    ❌ Failed: Returned empty page array.`, colors.red);
        }
    } catch (err) {
        log(`    ❌ Error: ${err}`, colors.red);
    }

    console.log("\n🏁 Test Sequence Complete.");
}

runTest();
