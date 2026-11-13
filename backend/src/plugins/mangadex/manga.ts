import { BASE_URL, mangadexFetch } from "./http";

export interface RandomMangaOptions {
  includes?: string[];
  contentRating?: string[];
  includedTags?: string[];
  excludedTags?: string[];
  includedTagsMode?: "AND" | "OR";
  excludedTagsMode?: "AND" | "OR";
}

export interface AggregateOptions {
  translatedLanguage?: string[];
  groups?: string[];
}

export interface FeedOptions {
  limit?: number;
  offset?: number;
  translatedLanguage?: string[];
  originalLanguage?: string[];
  excludedOriginalLanguage?: string[];
  contentRating?: string[];
  excludedGroups?: string[];
  excludedUploaders?: string[];
  includeFutureUpdates?: boolean;
  includeEmptyPages?: boolean;
  includeFuturePublishAt?: boolean;
  includeExternalUrl?: boolean;
  createdAtSince?: string;
  updatedAtSince?: string;
  publishAtSince?: string;
  order?: Record<string, "asc" | "desc">;
  includes?: string[];
}

export class Manga {
  static async get(mangaId: string, includes?: string[]): Promise<any> {
    const urlParams = new URLSearchParams();
    if (includes) includes.forEach((inc) => urlParams.append("includes[]", inc));

    const queryString = urlParams.toString() ? `?${urlParams.toString()}` : "";
    const res = await mangadexFetch(`${BASE_URL}/manga/${mangaId}${queryString}`);
    return res.json();
  }

  static async random(options: RandomMangaOptions = {}): Promise<any> {
    const urlParams = new URLSearchParams();
    if (options.includes) options.includes.forEach((inc) => urlParams.append("includes[]", inc));
    if (options.contentRating) options.contentRating.forEach((rating) => urlParams.append("contentRating[]", rating));
    if (options.includedTags) options.includedTags.forEach((tag) => urlParams.append("includedTags[]", tag));
    if (options.excludedTags) options.excludedTags.forEach((tag) => urlParams.append("excludedTags[]", tag));
    if (options.includedTagsMode) urlParams.append("includedTagsMode", options.includedTagsMode);
    if (options.excludedTagsMode) urlParams.append("excludedTagsMode", options.excludedTagsMode);

    const queryString = urlParams.toString() ? `?${urlParams.toString()}` : "";
    const res = await mangadexFetch(`${BASE_URL}/manga/random${queryString}`);
    return res.json();
  }

  static async tagList(): Promise<any> {
    const res = await mangadexFetch(`${BASE_URL}/manga/tag`);
    return res.json();
  }

  static async aggregate(mangaId: string, options: AggregateOptions = {}): Promise<any> {
    const urlParams = new URLSearchParams();
    if (options.translatedLanguage) options.translatedLanguage.forEach((lang) => urlParams.append("translatedLanguage[]", lang));
    if (options.groups) options.groups.forEach((group) => urlParams.append("groups[]", group));

    const queryString = urlParams.toString() ? `?${urlParams.toString()}` : "";
    const res = await mangadexFetch(`${BASE_URL}/manga/${mangaId}/aggregate${queryString}`);
    return res.json();
  }

  static async feed(mangaId: string, options: FeedOptions = {}): Promise<any> {
    const {
      limit = 100,
      offset = 0,
      translatedLanguage,
      originalLanguage,
      excludedOriginalLanguage,
      contentRating,
      excludedGroups,
      excludedUploaders,
      includeFutureUpdates,
      includeEmptyPages,
      includeFuturePublishAt,
      includeExternalUrl,
      createdAtSince,
      updatedAtSince,
      publishAtSince,
      order,
      includes,
    } = options;

    const urlParams = new URLSearchParams();
    urlParams.append("limit", String(limit));
    urlParams.append("offset", String(offset));

    if (translatedLanguage) translatedLanguage.forEach((lang) => urlParams.append("translatedLanguage[]", lang));
    if (originalLanguage) originalLanguage.forEach((lang) => urlParams.append("originalLanguage[]", lang));
    if (excludedOriginalLanguage) excludedOriginalLanguage.forEach((lang) => urlParams.append("excludedOriginalLanguage[]", lang));
    if (contentRating) contentRating.forEach((rating) => urlParams.append("contentRating[]", rating));
    if (excludedGroups) excludedGroups.forEach((group) => urlParams.append("excludedGroups[]", group));
    if (excludedUploaders) excludedUploaders.forEach((uploader) => urlParams.append("excludedUploaders[]", uploader));
    if (includeFutureUpdates !== undefined) urlParams.append("includeFutureUpdates", String(includeFutureUpdates).toLowerCase());
    if (includeEmptyPages !== undefined) urlParams.append("includeEmptyPages", String(includeEmptyPages).toLowerCase());
    if (includeFuturePublishAt !== undefined) urlParams.append("includeFuturePublishAt", String(includeFuturePublishAt).toLowerCase());
    if (includeExternalUrl !== undefined) urlParams.append("includeExternalUrl", String(includeExternalUrl).toLowerCase());
    if (createdAtSince) urlParams.append("createdAtSince", createdAtSince);
    if (updatedAtSince) urlParams.append("updatedAtSince", updatedAtSince);
    if (publishAtSince) urlParams.append("publishAtSince", publishAtSince);
    if (order) {
      for (const [key, value] of Object.entries(order)) {
        urlParams.append(`order[${key}]`, value);
      }
    }
    if (includes) includes.forEach((inc) => urlParams.append("includes[]", inc));

    const res = await mangadexFetch(`${BASE_URL}/manga/${mangaId}/feed?${urlParams.toString()}`);
    return res.json();
  }

  static async relation(mangaId: string, includes?: string[]): Promise<any> {
    const urlParams = new URLSearchParams();
    if (includes) includes.forEach((inc) => urlParams.append("includes[]", inc));

    const queryString = urlParams.toString() ? `?${urlParams.toString()}` : "";
    const res = await mangadexFetch(`${BASE_URL}/manga/${mangaId}/relation${queryString}`);
    return res.json();
  }
}