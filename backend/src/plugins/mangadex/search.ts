import { BASE_URL, mangadexFetch } from "./http";

export interface SearchOptions {
  title?: string;
  limit?: number;
  offset?: number;
  authorOrArtist?: string;
  authors?: string[];
  artists?: string[];
  year?: number;
  includedTags?: string[];
  excludedTags?: string[];
  includedTagsMode?: "AND" | "OR";
  excludedTagsMode?: "AND" | "OR";
  status?: string[];
  originalLanguage?: string[];
  excludedOriginalLanguage?: string[];
  availableTranslatedLanguage?: string[];
  publicationDemographic?: string[];
  ids?: string[];
  contentRating?: string[];
  hasAvailableChapters?: boolean;
  hasUnavailableChapters?: boolean;
  order?: Record<string, "asc" | "desc">;
  includes?: string[];
}

export class Search {
  static async search(options: SearchOptions = {}): Promise<any> {
    const {
      limit = 10,
      offset = 0,
      title,
      authorOrArtist,
      authors,
      artists,
      year,
      includedTags,
      excludedTags,
      includedTagsMode,
      excludedTagsMode,
      status,
      originalLanguage,
      excludedOriginalLanguage,
      availableTranslatedLanguage,
      publicationDemographic,
      ids,
      contentRating,
      hasAvailableChapters,
      hasUnavailableChapters,
      order,
      includes,
    } = options;

    const urlParams = new URLSearchParams();
    urlParams.append("limit", String(limit));
    urlParams.append("offset", String(offset));

    if (title) urlParams.append("title", title);
    if (authorOrArtist) urlParams.append("authorOrArtist", authorOrArtist);
    if (authors) authors.forEach((id) => urlParams.append("authors[]", id));
    if (artists) artists.forEach((id) => urlParams.append("artists[]", id));
    if (year !== undefined && year !== null) urlParams.append("year", String(year));
    if (includedTags) includedTags.forEach((tag) => urlParams.append("includedTags[]", tag));
    if (excludedTags) excludedTags.forEach((tag) => urlParams.append("excludedTags[]", tag));
    if (includedTagsMode) urlParams.append("includedTagsMode", includedTagsMode);
    if (excludedTagsMode) urlParams.append("excludedTagsMode", excludedTagsMode);
    if (status) status.forEach((s) => urlParams.append("status[]", s));
    if (originalLanguage) originalLanguage.forEach((lang) => urlParams.append("originalLanguage[]", lang));
    if (excludedOriginalLanguage) excludedOriginalLanguage.forEach((lang) => urlParams.append("excludedOriginalLanguage[]", lang));
    if (availableTranslatedLanguage) availableTranslatedLanguage.forEach((lang) => urlParams.append("availableTranslatedLanguage[]", lang));
    if (publicationDemographic) publicationDemographic.forEach((demo) => urlParams.append("publicationDemographic[]", demo));
    if (ids) ids.forEach((id) => urlParams.append("ids[]", id));
    if (contentRating) contentRating.forEach((rating) => urlParams.append("contentRating[]", rating));
    if (hasAvailableChapters !== undefined && hasAvailableChapters !== null) {
      urlParams.append("hasAvailableChapters", String(hasAvailableChapters).toLowerCase());
    }
    if (hasUnavailableChapters !== undefined && hasUnavailableChapters !== null) {
      urlParams.append("hasUnavailableChapters", String(hasUnavailableChapters).toLowerCase());
    }
    if (order) {
      for (const [key, value] of Object.entries(order)) {
        urlParams.append(`order[${key}]`, value);
      }
    }
    if (includes) includes.forEach((inc) => urlParams.append("includes[]", inc));

    const res = await mangadexFetch(`${BASE_URL}/manga?${urlParams.toString()}`);
    return res.json();
  }

  static async query(title: string): Promise<string[]> {
    const data = await Search.search({ title });
    return (data?.data || []).map((manga: { id: string }) => manga.id);
  }
}