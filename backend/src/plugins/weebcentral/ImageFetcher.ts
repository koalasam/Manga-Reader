import * as cheerio from 'cheerio';
import { BASE_URL, absoluteUrl, fetchHtml } from './http';

/** Accepts a chapter URL or bare chapter ID. */
export function extractChapterId(chapterUrlOrId: string): string {
    const input = chapterUrlOrId.trim();
    if (/^[0-9A-Za-z]{26}$/.test(input)) return input;
    const m = input.match(/\/chapters\/([^/?#]+)/);
    if (!m) throw new Error('Invalid WeebCentral chapter URL. Could not extract Chapter ID.');
    return m[1];
}

/** Returns the ordered list of page image URLs for one chapter. */
export async function fetchChapterImages(chapterUrlOrId: string): Promise<string[]> {
    const id = extractChapterId(chapterUrlOrId);
    const html = await fetchHtml(
        `${BASE_URL}/chapters/${id}/images?is_prev=False&current_page=1&reading_style=long_strip`,
        { Referer: `${BASE_URL}/chapters/${id}` }
    );
    return parseImageHtml(html);
}

export function parseImageHtml(html: string): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];
    $('img').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src');
        if (!src || src.startsWith('data:')) return;
        const abs = absoluteUrl(src);
        if (!urls.includes(abs)) urls.push(abs);
    });
    return urls;
}