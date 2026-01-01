import * as cheerio from 'cheerio';
import { performance } from 'perf_hooks';
// import * as fs from 'fs';

// =========================================================
// 1. CONFIGURATION (Targeting ManhuaPlus)
// =========================================================

interface BenchmarkConfig {
    readonly url: string;
    readonly iterations: number;
    readonly settings: {
        readonly cssSelector: string;
        readonly regexPattern: RegExp;
        readonly regexGroups: {
            readonly imageIndex: number;
            readonly linkIndex: number;
            readonly titleIndex: number;
        };
    };
}

const CONFIG: BenchmarkConfig = {
    // Target URL (from your error log)
    url: 'https://manhuaplus.com/',

    iterations: 1, // Reduced slightly for heavy WP pages

    settings: {
        // CHEERIO STRATEGY
        // Target: <div class="post-title"> <h3 class="h5"> <a href="...">
        cssSelector: 'div#loop-content > div.page-listing-item > div.row.row-eq-height > div.col-6.col-md-3.badge-pos-2',
        // REGEX STRATEGY
        // Explanation:
        // 1. <h3 class="h5">  -> Find the header container
        // 2. [\s\S]*?         -> Match ANY character (including newlines) non-greedily
        // 3. href="([^"]+)"   -> Capture the Link (Group 1)
        // 4. [^>]*>           -> End of opening tag
        // 5. ([^<]+)          -> Capture the Title Text (Group 2)
        regexPattern: /<div\b[^>]*class=["'][^"']*\bcol-6\b[^"']*["'][^>]*>[\s\S]*?href=["']([^"']+)["'][\s\S]*?title=["']([^"']+)["'][\s\S]*?data-src=["']([^"']+)["'][\s\S]*?<\/div>/g,


        regexGroups: {
            linkIndex: 1,
            titleIndex: 2,
            imageIndex: 3,
        }
    }
};

// =========================================================
// 2. CORE TYPES & HELPERS
// =========================================================

interface ScrapeResult {
    title: string;
    link: string;
    image?: string;
}

async function fetchHTML(url: string): Promise<string> {
    console.log(`\n🌐 Fetching live data from: ${url}...`);
    try {
        const response = await fetch(url, {
            headers: {
                // Mimic a real Chrome browser on Windows to avoid being blocked
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const html = await response.text();
        console.log(`✅ Downloaded ${(html.length / 1024).toFixed(2)} KB of HTML.`);
        return html;
    } catch (e) {
        if (e instanceof Error) console.error("Fetch failed:", e.message);
        process.exit(1);
    }
}

// =========================================================
// 3. PARSING LOGIC
// =========================================================

function parseWithRegex(html: string): ScrapeResult[] {
    const results: ScrapeResult[] = [];
    const { regexPattern, regexGroups } = CONFIG.settings;

    // IMPORTANT: Reset index for global regex
    regexPattern.lastIndex = 0;

    const matches = html.matchAll(regexPattern);

    for (const match of matches) {
        if (match[regexGroups.linkIndex] && match[regexGroups.titleIndex]) {
            results.push({
                link: match[regexGroups.linkIndex].trim(),
                title: match[regexGroups.titleIndex].trim(),
                image: match[regexGroups.imageIndex]?.trim() || '',
            });
        }
    }
    return results;
}

function parseWithCheerio(html: string): ScrapeResult[] {
    const results: ScrapeResult[] = [];
    const $ = cheerio.load(html);

    $(CONFIG.settings.cssSelector).each((_, el) => {
        const element = $(el);
        const title = element.text().trim();
        const link = element.find('a').attr('href') || '';
        if (title && link) {
            results.push({ title, link });
        }
    }); return results;
}

// =========================================================
// 4. BENCHMARK RUNNER
// =========================================================

async function runBenchmark() {
    const html = await fetchHTML(CONFIG.url);

    // --- VERIFICATION PHASE ---
    console.log('\n🔍 VERIFYING EXTRACTION LOGIC...');
    const previewRegex = parseWithRegex(html);
    const previewCheerio = parseWithCheerio(html);


    // fs.writeFileSync('previewRegex.json', JSON.stringify(previewRegex, null, 2))

    console.log(`   Regex Found   : ${previewRegex.length} items`);
    if (previewRegex.length > 0) console.log(`   👉 Ex: [${previewRegex[0].title.substring(0, 25)}...] -> ${previewRegex[0].link.substring(0, 30)}...`);

    console.log(`   Cheerio Found : ${previewCheerio.length} items`);
    if (previewCheerio.length > 0) console.log(`   👉 Ex: [${previewCheerio[0].title.substring(0, 25)}...] -> ${previewCheerio[0].link.substring(0, 30)}...`);

    // --- DEBUGGING IF EMPTY ---
    if (previewCheerio.length === 0) {
        console.error("\n❌ ERROR: Cheerio found 0 items.");
        console.error("   The HTML structure might be different than expected.");
        console.error("   Saving HTML to 'debug_fail.html' for inspection...");
        // fs.writeFileSync('debug_fail.html', html);
        console.log("   ✅ Saved 'debug_fail.html'. Open this file to see the real structure.");
        process.exit(1);
    }

    // --- SPEED TEST PHASE ---
    console.log(`\n⚡ STARTING SPEED TEST (${CONFIG.iterations} iterations)`);
    console.log('--------------------------------------------------');

    const startRegex = performance.now();
    for (let i = 0; i < CONFIG.iterations; i++) parseWithRegex(html);
    const endRegex = performance.now();
    const timeRegex = endRegex - startRegex;

    const startCheerio = performance.now();
    for (let i = 0; i < CONFIG.iterations; i++) parseWithCheerio(html);
    const endCheerio = performance.now();
    const timeCheerio = endCheerio - startCheerio;

    // --- FINAL RESULTS ---
    console.log(`\n📊 FINAL STATS:`);
    console.log(`   📝 REGEX   : ${timeRegex.toFixed(2)} ms total | ${(timeRegex / CONFIG.iterations).toFixed(4)} ms/op`);
    console.log(`   🐢 CHEERIO : ${timeCheerio.toFixed(2)} ms total | ${(timeCheerio / CONFIG.iterations).toFixed(4)} ms/op`);

    const faster = timeRegex < timeCheerio ? 'Regex' : 'Cheerio';
    const factor = (Math.max(timeRegex, timeCheerio) / Math.min(timeRegex, timeCheerio)).toFixed(1);

    console.log(`\n🏆 WINNER: \x1b[32m${faster} is ${factor}x faster\x1b[0m`);
    console.log('--------------------------------------------------');
}

runBenchmark();