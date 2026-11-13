import { searchWeebCentral } from './SearchFetcher';
import { fetchAndParseChapterList, extractSeriesId, Chapter } from './ChapterFetcher';
import { fetchChapterImages, extractChapterId } from './ImageFetcher';
import { downloadChapter, downloadChapters, makeCbz, sanitizeName } from './Downloader';
import { siteLimiter, RateLimiter, MAX_REQUESTS_PER_SECOND } from './RateLimiter';

export type { SearchResult, SearchOptions } from './SearchFetcher';
export type { Chapter } from './ChapterFetcher';
export type { DownloadOptions, DownloadEvent } from './Downloader';

export {
    searchWeebCentral,
    fetchAndParseChapterList,
    fetchChapterImages,
    extractSeriesId,
    extractChapterId,
    downloadChapter,
    downloadChapters,
    makeCbz,
    sanitizeName,
    siteLimiter,
    RateLimiter,
    MAX_REQUESTS_PER_SECOND,
};

export function sortChapters(chapters: Chapter[], order: 'asc' | 'desc' = 'asc'): Chapter[] {
    const dir = order === 'asc' ? 1 : -1;
    return [...chapters].sort((a, b) => dir * ((a.number ?? 0) - (b.number ?? 0)));
}

export const WeebCentral = {
    search: searchWeebCentral,
    getChapters: fetchAndParseChapterList,
    getChapterImages: fetchChapterImages,
    download: downloadChapters,
    downloadOne: downloadChapter,
    sortChapters,
    setRateLimit: (perSecond: number) => siteLimiter.setLimit(perSecond),
};

export default WeebCentral;