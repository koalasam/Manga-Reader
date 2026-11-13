import * as fs from 'fs/promises';
import { createWriteStream, existsSync } from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import * as unzipper from 'unzipper';
import { MangaDexAPI } from './plugins/mangadex/mangadex_api';
import { WeebCentral } from './plugins/weebcentral/weebcentral';
import { fetchBuffer, BASE_URL as WC_BASE } from './plugins/weebcentral/http';
import { sanitizeName } from './plugins/weebcentral/Downloader';

const CACHE_DIR = process.env.CACHE_DIR || '/cache';

export function getCbzPath(source: string, seriesId: string, chapterId: string): string {
  const safeSeries = sanitizeName(`${source}_${seriesId}`);
  const safeChapter = sanitizeName(`${chapterId}.cbz`);
  return path.join(CACHE_DIR, safeSeries, safeChapter);
}

export async function isChapterCached(source: string, seriesId: string, chapterId: string): Promise<boolean> {
  return existsSync(getCbzPath(source, seriesId, chapterId));
}

export async function cacheChapterAsCbz(source: string, seriesId: string, chapterId: string): Promise<string> {
  const cbzPath = getCbzPath(source, seriesId, chapterId);
  if (existsSync(cbzPath)) return cbzPath;

  const seriesDir = path.dirname(cbzPath);
  const tempDir = path.join(seriesDir, `.tmp_${sanitizeName(chapterId)}_${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    let imageUrls: string[] = [];
    let headers: Record<string, string> = {};

    if (source === 'mangadex') {
      const atHome = await MangaDexAPI.atHomeServer(chapterId);
      imageUrls = MangaDexAPI.chapterPageUrls(atHome, false);
    } else if (source === 'weebcentral') {
      imageUrls = await WeebCentral.getChapterImages(chapterId);
      headers = { Referer: `${WC_BASE}/` };
    } else {
      throw new Error(`Unsupported source: ${source}`);
    }

    if (!imageUrls.length) throw new Error('No pages returned from upstream source');

    const pad = Math.max(3, String(imageUrls.length).length);

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      const baseName = String(i + 1).padStart(pad, '0');

      if (source === 'weebcentral') {
        const { data, contentType } = await fetchBuffer(url, headers);
        const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
        await fs.writeFile(path.join(tempDir, `${baseName}${ext}`), data);
      } else {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed downloading page ${i + 1}: ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = path.extname(new URL(url).pathname) || '.jpg';
        await fs.writeFile(path.join(tempDir, `${baseName}${ext}`), buf);
      }
    }

    await packCbz(tempDir, cbzPath);
    return cbzPath;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function packCbz(sourceDir: string, outFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const out = createWriteStream(outFile);
    const zip = archiver('zip', { zlib: { level: 0 } });
    out.on('close', () => resolve());
    out.on('error', reject);
    zip.on('error', reject);
    zip.pipe(out);
    zip.directory(sourceDir, false);
    zip.finalize();
  });
}

export async function listCbzPages(cbzPath: string): Promise<string[]> {
  const directory = await unzipper.Open.file(cbzPath);
  return directory.files
    .filter((f: unzipper.File) => f.type === 'File' && /\.(jpe?g|png|webp|gif|avif)$/i.test(f.path))
    .map((f: unzipper.File) => f.path)
    .sort();
}

export async function extractCbzPage(cbzPath: string, pageName: string): Promise<{ buffer: Buffer; mime: string }> {
  const directory = await unzipper.Open.file(cbzPath);
  const file = directory.files.find((f: unzipper.File) => f.path === pageName);
  if (!file) throw new Error('Page not found in CBZ');
  const buffer = await file.buffer();
  const ext = path.extname(pageName).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.gif' ? 'image/gif' : 'image/jpeg';
  return { buffer, mime };
}