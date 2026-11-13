import { Search, SearchOptions } from "./search";
import { Manga, RandomMangaOptions, AggregateOptions, FeedOptions } from "./manga";
import { Chapter, ChapterListOptions, AtHomeResponse } from "./chapter";
import { Cover, CoverListOptions } from "./cover";
import { Author, AuthorListOptions } from "./author";
import { Ping } from "./ping";

export class MangaDexAPI {
  // ---- routes to search.ts ----
  static async search(options?: SearchOptions) {
    return Search.search(options);
  }

  static async query(title: string) {
    return Search.query(title);
  }

  // ---- routes to manga.ts ----
  static async getManga(mangaId: string, includes?: string[]) {
    return Manga.get(mangaId, includes);
  }

  static async randomManga(options?: RandomMangaOptions) {
    return Manga.random(options);
  }

  static async tagList() {
    return Manga.tagList();
  }

  static async mangaAggregate(mangaId: string, options?: AggregateOptions) {
    return Manga.aggregate(mangaId, options);
  }

  static async mangaFeed(mangaId: string, options?: FeedOptions) {
    return Manga.feed(mangaId, options);
  }

  static async mangaRelation(mangaId: string, includes?: string[]) {
    return Manga.relation(mangaId, includes);
  }

  // ---- routes to chapter.ts ----
  static async chapterList(options?: ChapterListOptions) {
    return Chapter.list(options);
  }

  static async getChapter(chapterId: string, includes?: string[]) {
    return Chapter.get(chapterId, includes);
  }

  static async atHomeServer(chapterId: string, forcePort443: boolean = false) {
    return Chapter.atHomeServer(chapterId, forcePort443);
  }

  static chapterPageUrls(atHomeResponse: AtHomeResponse, dataSaver: boolean = false) {
    return Chapter.pageUrls(atHomeResponse, dataSaver);
  }

  // ---- routes to cover.ts ----
  static async coverList(options?: CoverListOptions) {
    return Cover.list(options);
  }

  static async getCover(coverId: string, includes?: string[]) {
    return Cover.get(coverId, includes);
  }

  static coverImageUrl(mangaId: string, filename: string, size?: 256 | 512) {
    return Cover.imageUrl(mangaId, filename, size);
  }

  // ---- routes to author.ts ----
  static async authorList(options?: AuthorListOptions) {
    return Author.list(options);
  }

  static async getAuthor(authorId: string, includes?: string[]) {
    return Author.get(authorId, includes);
  }

  // ---- routes to ping.ts ----
  static async ping() {
    return Ping.ping();
  }
}