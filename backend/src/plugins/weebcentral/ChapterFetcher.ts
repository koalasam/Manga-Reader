import * as fs from 'fs/promises';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { BASE_URL, absoluteUrl, fetchHtml } from './http';

export interface Chapter {
    id: string;
    title: string;
    url: string;
    /** Parsed from the title when possible (e.g. "Chapter 12.5" -> 12.5). */
    number?: number;
}

/** Extracts the series ID from a series URL (or accepts a bare ID). */
export function extractSeriesId(seriesUrlOrId: string): string {
    const input = seriesUrlOrId.trim();
    if (/^[0-9A-Za-z]{26}$/.test(input)) return input;
    const match = input.match(/\/series\/([^/?#]+)/);
    if (!match) throw new Error('Invalid WeebCentral series URL. Could not extract Series ID.');
    return match[1];
}

/**
 * Fetches and parses the full chapter list for a series.
 * Chapters are returned in the order the site lists them (newest first).
 * @param seriesUrl Series URL or bare series ID.
 * @param saveHtmlPath Optional path to save the raw HTML response.
 */
export async function fetchAndParseChapterList(seriesUrl: string, saveHtmlPath?: string): Promise<Chapter[]> {
    const seriesId = extractSeriesId(seriesUrl);
    const html = await fetchHtml(`${BASE_URL}/series/${seriesId}/full-chapter-list`);

    if (saveHtmlPath) {
        await fs.writeFile(saveHtmlPath, html, 'utf-8');
        console.log(`Raw HTML saved to: ${path.resolve(saveHtmlPath)}`);
    }
    return parseChapterHtml(html);
}

export function parseChapterHtml(html: string): Chapter[] {
    const $ = cheerio.load(html);
    const seen = new Set<string>();
    const chapters: Chapter[] = [];

    $('a[href*="/chapters/"]').each((_, el) => {
        const $a = $(el);
        const href = $a.attr('href');
        if (!href) return;

        const m = new URL(href, BASE_URL).pathname.match(/^\/chapters\/([^/]+)/);
        if (!m || seen.has(m[1])) return;

        const title = (
            $a.find('.grow span').first().text() ||
            $a.find('span').first().text() ||
            $a.text()
        )
            .replace(/\s+/g, ' ')
            .trim();
        if (!title) return;

        seen.add(m[1]);
        const num = title.match(/(\d+(?:\.\d+)?)\s*$/) || title.match(/(\d+(?:\.\d+)?)/);
        chapters.push({
            id: m[1],
            title,
            url: absoluteUrl(`/chapters/${m[1]}`),
            number: num ? parseFloat(num[1]) : undefined,
        });
    });

    return chapters;
}