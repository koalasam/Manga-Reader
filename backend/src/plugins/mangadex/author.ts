import { BASE_URL, mangadexFetch } from "./http";

export interface AuthorListOptions {
  limit?: number;
  offset?: number;
  ids?: string[];
  name?: string;
  order?: Record<string, "asc" | "desc">;
  includes?: string[];
}

export class Author {
  static async list(options: AuthorListOptions = {}): Promise<any> {
    const { limit = 10, offset = 0, ids, name, order, includes } = options;

    const urlParams = new URLSearchParams();
    urlParams.append("limit", String(limit));
    urlParams.append("offset", String(offset));

    if (ids) ids.forEach((id) => urlParams.append("ids[]", id));
    if (name) urlParams.append("name", name);
    if (order) {
      for (const [key, value] of Object.entries(order)) {
        urlParams.append(`order[${key}]`, value);
      }
    }
    if (includes) includes.forEach((inc) => urlParams.append("includes[]", inc));

    const res = await mangadexFetch(`${BASE_URL}/author?${urlParams.toString()}`);
    return res.json();
  }

  static async get(authorId: string, includes?: string[]): Promise<any> {
    const urlParams = new URLSearchParams();
    if (includes) includes.forEach((inc) => urlParams.append("includes[]", inc));

    const queryString = urlParams.toString() ? `?${urlParams.toString()}` : "";
    const res = await mangadexFetch(`${BASE_URL}/author/${authorId}${queryString}`);
    return res.json();
  }
}