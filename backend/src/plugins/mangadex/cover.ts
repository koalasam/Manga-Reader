import { BASE_URL, mangadexFetch } from "./http";
const CDN_URL = "https://uploads.mangadex.org";

export interface CoverListOptions {
  limit?: number;
  offset?: number;
  manga?: string[];
  ids?: string[];
  uploaders?: string[];
  locales?: string[];
  order?: Record<string, "asc" | "desc">;
  includes?: string[];
}

export class Cover {
  static async list(options: CoverListOptions = {}): Promise<any> {
    const {
      limit = 10,
      offset = 0,
      manga,
      ids,
      uploaders,
      locales,
      order,
      includes,
    } = options;

    const urlParams = new URLSearchParams();
    urlParams.append("limit", String(limit));
    urlParams.append("offset", String(offset));

    if (manga) manga.forEach((m) => urlParams.append("manga[]", m));
    if (ids) ids.forEach((id) => urlParams.append("ids[]", id));
    if (uploaders) uploaders.forEach((u) => urlParams.append("uploaders[]", u));
    if (locales) locales.forEach((l) => urlParams.append("locales[]", l));
    if (order) {
      for (const [key, value] of Object.entries(order)) {
        urlParams.append(`order[${key}]`, value);
      }
    }
    if (includes) includes.forEach((inc) => urlParams.append("includes[]", inc));

    const res = await mangadexFetch(`${BASE_URL}/cover?${urlParams.toString()}`);
    return res.json();
  }

  static async get(coverId: string, includes?: string[]): Promise<any> {
    const urlParams = new URLSearchParams();
    if (includes) includes.forEach((inc) => urlParams.append("includes[]", inc));

    const queryString = urlParams.toString() ? `?${urlParams.toString()}` : "";
    const res = await mangadexFetch(`${BASE_URL}/cover/${coverId}${queryString}`);
    return res.json();
  }

  static imageUrl(mangaId: string, filename: string, size?: 256 | 512): string {
    if (size === 256) {
      return `${CDN_URL}/covers/${mangaId}/${filename}.256.jpg`;
    }
    if (size === 512) {
      return `${CDN_URL}/covers/${mangaId}/${filename}.512.jpg`;
    }
    return `${CDN_URL}/covers/${mangaId}/${filename}`;
  }
}