// Loose typings for the pieces of the MangaDex response payloads the app
// actually reads. MangaDex's API returns a generic JSON:API-ish shape with
// `attributes` and `relationships`, so these are intentionally permissive
// rather than exhaustive.

export interface MangaDexRelationship {
  id: string;
  type: string;
  attributes?: Record<string, any>;
}

export interface MangaAttributes {
  title: Record<string, string>;
  altTitles?: Record<string, string>[];
  description?: Record<string, string>;
  status?: string;
  year?: number | null;
  contentRating?: string;
  tags?: {
    id: string;
    attributes: { name: Record<string, string> };
  }[];
}

export interface MangaResource {
  id: string;
  type: "manga";
  attributes: MangaAttributes;
  relationships: MangaDexRelationship[];
}

export interface ChapterAttributes {
  volume?: string | null;
  chapter?: string | null;
  title?: string | null;
  translatedLanguage: string;
  pages: number;
  publishAt?: string;
}

export interface ChapterResource {
  id: string;
  type: "chapter";
  attributes: ChapterAttributes;
  relationships: MangaDexRelationship[];
}

export interface MangaDexListResponse<T> {
  result: string;
  response: string;
  data: T[];
  limit: number;
  offset: number;
  total: number;
}

export interface MangaDexEntityResponse<T> {
  result: string;
  response: string;
  data: T;
}
