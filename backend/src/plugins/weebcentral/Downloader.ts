import * as fs from 'fs/promises';
import { createWriteStream } from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { Chapter } from './ChapterFetcher';
import { fetchChapterImages } from './ImageFetcher';
import { BASE_URL, fetchBuffer } from './http';

export type DownloadEvent =
    | { type: 'start'; totalChapters: number }
    | { type: 'chapter-start'; chapter: string; index: number; totalChapters: number }
    | { type: 'chapter-pages'; chapter: string; totalPages: number }
    | { type: 'page'; chapter: string; page: number; totalPages: number }
    | { type: 'chapter-done'; chapter: string; index: number; cbz?: string }
    | { type: 'chapter-error'; chapter: string; error: string }
    | { type: 'done'; ok: number; failed: number; cancelled: boolean };

export interface DownloadOptions {
    outputDir: string;
    seriesName: string;
    /** Also pack each chapter into a .cbz archive. */
    cbz?: boolean;
    /** Parallel image downloads (the rate limiter still caps hits per second). */
    concurrency?: number;
    /** Skip pages already on disk. Default true. */
    skipExisting?: boolean;
    signal?: AbortSignal;
    onProgress?: (e: DownloadEvent) => void;
}

export function sanitizeName(name: string): string {
    return (
        name
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/\s+/g, ' ')
            .replace(/[. ]+$/, '')
            .trim()
            .slice(0, 120) || 'untitled'
    );
}

function extensionFor(url: string, contentType: string): string {
    const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
    if (/^\.(jpe?g|png|webp|gif|avif)$/.test(fromUrl)) return fromUrl;
    if (contentType.includes('png')) return '.png';
    if (contentType.includes('webp')) return '.webp';
    if (contentType.includes('gif')) return '.gif';
    if (contentType.includes('avif')) return '.avif';
    return '.jpg';
}

async function runPool<T>(items: T[], size: number, worker: (item: T, i: number) => Promise<void>) {
    let next = 0;
    const runners = Array.from({ length: Math.max(1, Math.min(size, items.length)) }, async () => {
        while (next < items.length) {
            const i = next++;
            await worker(items[i], i);
        }
    });
    await Promise.all(runners);
}

export async function downloadChapter(
    chapter: Chapter,
    seriesDir: string,
    opts: DownloadOptions
): Promise<string | undefined> {
    const { onProgress, signal } = opts;
    const chapterName = sanitizeName(chapter.title);
    const chapterDir = path.join(seriesDir, chapterName);
    await fs.mkdir(chapterDir, { recursive: true });

    const images = await fetchChapterImages(chapter.url);
    if (!images.length) throw new Error('No page images found for this chapter.');
    onProgress?.({ type: 'chapter-pages', chapter: chapter.title, totalPages: images.length });

    const existing = opts.skipExisting === false ? [] : await fs.readdir(chapterDir);
    const pad = Math.max(3, String(images.length).length);
    let done = 0;

    await runPool(images, opts.concurrency ?? 6, async (url, i) => {
        if (signal?.aborted) return;
        const base = String(i + 1).padStart(pad, '0');
        if (!existing.some((f) => f.startsWith(`${base}.`))) {
            const { data, contentType } = await fetchBuffer(url, { Referer: `${BASE_URL}/` });
            await fs.writeFile(path.join(chapterDir, base + extensionFor(url, contentType)), data);
        }
        onProgress?.({ type: 'page', chapter: chapter.title, page: ++done, totalPages: images.length });
    });

    if (signal?.aborted) throw new Error('Cancelled');

    if (opts.cbz) {
        const cbzPath = path.join(seriesDir, `${chapterName}.cbz`);
        await makeCbz(chapterDir, cbzPath);
        return cbzPath;
    }
    return undefined;
}

export function makeCbz(sourceDir: string, outFile: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const out = createWriteStream(outFile);
        const zip = archiver('zip', { zlib: { level: 0 } }); // images are already compressed
        out.on('close', () => resolve());
        out.on('error', reject);
        zip.on('error', reject);
        zip.pipe(out);
        zip.directory(sourceDir, false);
        zip.finalize();
    });
}

/** Downloads many chapters sequentially into <outputDir>/<seriesName>/<chapter>/. */
export async function downloadChapters(chapters: Chapter[], opts: DownloadOptions) {
    const seriesDir = path.join(opts.outputDir, sanitizeName(opts.seriesName));
    await fs.mkdir(seriesDir, { recursive: true });
    opts.onProgress?.({ type: 'start', totalChapters: chapters.length });

    let ok = 0;
    let failed = 0;
    for (let i = 0; i < chapters.length; i++) {
        if (opts.signal?.aborted) break;
        const ch = chapters[i];
        opts.onProgress?.({ type: 'chapter-start', chapter: ch.title, index: i, totalChapters: chapters.length });
        try {
            const cbz = await downloadChapter(ch, seriesDir, opts);
            ok++;
            opts.onProgress?.({ type: 'chapter-done', chapter: ch.title, index: i, cbz });
        } catch (err) {
            failed++;
            opts.onProgress?.({
                type: 'chapter-error',
                chapter: ch.title,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    const cancelled = !!opts.signal?.aborted;
    opts.onProgress?.({ type: 'done', ok, failed, cancelled });
    return { ok, failed, cancelled, seriesDir };
}