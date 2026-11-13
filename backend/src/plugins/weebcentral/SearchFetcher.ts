import * as fs from 'fs/promises';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { BASE_URL, absoluteUrl, fetchHtml } from './http';

export interface SearchResult {
    name: string;
    id: string;
    thumbnailUrl: string;
    url: string;
}

export interface SearchOptions {
    text?: string;
    limit?: number;
    offset?: number;
    sort?: 'Best Match' | 'Highest Rated' | 'Most Popular' | 'Latest Update' | 'Newest' | 'Oldest' | 'A-Z' | 'Z-A';
    order?: 'Ascending' | 'Descending';
    official?: 'Any' | 'Yes' | 'No';
    author?: string;
    displayMode?: 'Minimal Display' | 'Detailed Display';
    saveHtmlPath?: string;
}

const SERIES_ID = /^[0-9A-Za-z]{26}$/;

/** Searches WeebCentral and returns series name, ID, thumbnail URL and page URL. */
export async function searchWeebCentral(options: SearchOptions = {}): Promise<SearchResult[]> {
    const params = new URLSearchParams();
    params.set('text', options.text ?? '');
    params.set('limit', String(options.limit ?? 32));
    params.set('offset', String(options.offset ?? 0));
    params.set('sort', options.sort ?? 'Best Match');
    params.set('order', options.order ?? 'Ascending');
    params.set('official', options.official ?? 'Any');
    if (options.author) params.set('author', options.author);
    params.set('display_mode', options.displayMode ?? 'Minimal Display');

    const html = await fetchHtml(`${BASE_URL}/search/data?${params.toString()}`);

    if (options.saveHtmlPath) {
        await fs.writeFile(options.saveHtmlPath, html, 'utf-8');
        console.log(`Raw HTML saved to: ${path.resolve(options.saveHtmlPath)}`);
    }

    return parseSearchHtml(html);
}

export function parseSearchHtml(html: string): SearchResult[] {
    const $ = cheerio.load(html);
    const byId = new Map<string, SearchResult>();

    $('a[href*="/series/"]').each((_, el) => {
        const $a = $(el);
        const href = $a.attr('href');
        if (!href) return;

        let pathname: string;
        try {
            pathname = new URL(href, BASE_URL).pathname;
        } catch {
            return;
        }
        const m = pathname.match(/^\/series\/([^/]+)/);
        if (!m || !SERIES_ID.test(m[1])) return;
        const id = m[1];

        const $img = $a.find('img').first();
        const alt = ($img.attr('alt') || '').replace(/\s*cover\s*$/i, '').trim();
        const text = $a.text().replace(/\s+/g, ' ').trim();
        const name = alt || text;

        // Prefer the <img> src, fall back to a <source srcset> inside the card.
        const thumb =
            $img.attr('src') ||
            $img.attr('data-src') ||
            ($a.find('source').first().attr('srcset') || '').split(/\s+/)[0] ||
            '';

        const existing = byId.get(id);
        if (existing) {
            // The same series can appear in several nested anchors; fill any blanks.
            if (!existing.name && name) existing.name = name;
            if (!existing.thumbnailUrl && thumb) existing.thumbnailUrl = thumb;
            return;
        }
        byId.set(id, { id, name, thumbnailUrl: thumb, url: absoluteUrl(pathname) });
    });

    return [...byId.values()].filter((r) => r.name);
}