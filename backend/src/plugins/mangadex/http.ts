import { mangaDexLimiter } from './RateLimiter';

export const BASE_URL = "https://api.mangadex.org";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function mangadexFetch(url: string, init: RequestInit = {}, retries = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await mangaDexLimiter.acquire();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'User-Agent': 'MangaReader/1.0 (Cross-Platform Manga Reader)',
          ...(init.headers || {}),
        },
      });
      clearTimeout(timeoutId);

      if (res.ok) return res;

      if (res.status === 429 && attempt < retries) {
        const retryAfterSec = Number(res.headers.get('retry-after')) || Number(res.headers.get('x-ratelimit-retry-after'));
        const waitMs = retryAfterSec > 0 ? retryAfterSec * 1000 : 1000 * 2 ** attempt;
        await sleep(waitMs);
        continue;
      }

      if (res.status >= 500 && attempt < retries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }

      const bodyText = await res.text().catch(() => '');
      throw new Error(`HTTP error! status: ${res.status} ${bodyText.slice(0, 300)}`.trim());
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
      if (attempt >= retries) break;
      await sleep(500 * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}