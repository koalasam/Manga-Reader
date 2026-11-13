import { siteLimiter } from './RateLimiter';

export const BASE_URL = 'https://weebcentral.com';

const DEFAULT_HEADERS: Record<string, string> = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
    Referer: `${BASE_URL}/`,
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * fetch() wrapper: rate limited (every attempt counts as a hit), with timeout
 * and retry/backoff on network errors, 429 and 5xx.
 */
export async function siteFetch(url: string, init: RequestInit = {}, retries = 3): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
        await siteLimiter.acquire();
        try {
            const res = await fetch(url, {
                ...init,
                headers: { ...DEFAULT_HEADERS, ...(init.headers as Record<string, string> | undefined) },
                signal: AbortSignal.timeout(30_000),
            });
            if (res.ok) return res;
            if ((res.status === 429 || res.status >= 500) && attempt < retries) {
                const retryAfter = Number(res.headers.get('retry-after'));
                await sleep(retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
                continue;
            }
            throw new Error(`Request failed: ${res.status} ${res.statusText} (${url})`);
        } catch (err) {
            lastError = err;
            if (attempt >= retries) break;
            await sleep(500 * 2 ** attempt);
        }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchHtml(url: string, extraHeaders: Record<string, string> = {}): Promise<string> {
    const res = await siteFetch(url, { headers: { 'HX-Request': 'true', ...extraHeaders } });
    return res.text();
}

export async function fetchBuffer(
    url: string,
    extraHeaders: Record<string, string> = {}
): Promise<{ data: Buffer; contentType: string }> {
    const res = await siteFetch(url, { headers: { Accept: 'image/*,*/*;q=0.8', ...extraHeaders } });
    return {
        data: Buffer.from(await res.arrayBuffer()),
        contentType: res.headers.get('content-type') || '',
    };
}

export function absoluteUrl(href: string): string {
    return new URL(href, BASE_URL).toString();
}