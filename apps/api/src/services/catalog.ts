import { type CatalogBook, catalogBookSchema, type CatalogSearchResponse } from '@bubo/contracts';
import {
  type CatalogSource,
  coverCandidates,
  foldText,
  hardenCoverUrl,
  isCatalogId,
  MAX_BOOK_PAGES,
  MIN_CATALOG_QUERY_LENGTH,
  normalizeIsbn,
  openLibraryCoverById,
  parsePublishedYear,
  toIsbn13,
  toIsbn10,
  workMatchKey,
} from '@bubo/domain';
import { z } from 'zod';

import { AppError } from '../lib/errors';
import { type Logger } from '../lib/logger';
import { CatalogTransport, type Fetched } from './catalog-transport';
import { type CoverCache } from './cover-cache';
import { type CatalogCache } from './catalog-cache';

/**
 * Book catalog (ADR-016): Google Books + Open Library, plus BrasilAPI for Brazilian ISBNs,
 * and de-duplicated. Every upstream payload is validated with lenient Zod schemas and every cover
 * URL is hardened (https + allowlisted hosts). Results are cached (search 24 h, books 7 days).
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type CatalogServiceOptions = {
  fetch: FetchLike;
  cache: CatalogCache;
  googleApiKey?: string;
  contact?: string;
  covers?: CoverCache;
  timeoutMs?: number;
  logger?: Logger;
  /** Keeps cache warming alive after a fast response (Workers waitUntil, or the local runtime). */
  background?: (task: Promise<unknown>) => void;
};

const GOOGLE = 'https://www.googleapis.com/books/v1';
const OPEN_LIBRARY = 'https://openlibrary.org';
const CACHE_VERSION = 'v4';
/** Give the other source/fallback a chance to enrich a useful first answer without a long stall. */
export const SEARCH_MERGE_WAIT_MS = 1200;
/** An existing R2 object can be reused immediately; a slow new cover never holds up adding a book. */
export const COVER_REUSE_WAIT_MS = 100;
const TTL = {
  search: 24 * 60 * 60,
  partialSearch: 10 * 60,
  book: 7 * 24 * 60 * 60,
  notFound: 60 * 60,
} as const;
/** A typed query and its normalized spelling share one response and ordered cache writes. */
const searches = new WeakMap<CatalogCache, Map<string, Promise<CatalogSearchResponse>>>();

// ---------------------------------------------------------------- upstream shapes (lenient)

const googleVolumeSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{6,40}$/),
  volumeInfo: z.object({
    title: z.string().optional(),
    subtitle: z.string().optional(),
    authors: z.array(z.string()).optional(),
    publisher: z.string().optional(),
    publishedDate: z.string().optional(),
    description: z.string().optional(),
    industryIdentifiers: z.array(z.object({ type: z.string(), identifier: z.string() })).optional(),
    pageCount: z.number().optional(),
    imageLinks: z.record(z.string(), z.string()).optional(),
    language: z.string().optional(),
  }),
});
const googleListSchema = z
  .object({ items: z.array(z.unknown()).optional(), totalItems: z.number().optional() })
  .refine((data) => data.items !== undefined || data.totalItems === 0);

const openLibraryDocSchema = z.object({
  key: z.string().regex(/^\/works\/OL\d{1,12}W$/),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  author_name: z.array(z.string()).optional(),
  author_key: z.array(z.string()).optional(),
  first_publish_year: z.number().optional(),
  cover_i: z.number().int().positive().optional(),
  number_of_pages_median: z.number().optional(),
  publisher: z.array(z.string()).optional(),
  language: z.array(z.string()).optional(),
  edition_count: z.number().int().nonnegative().optional(),
  subject: z.array(z.string()).optional(),
  readinglog_count: z.number().nonnegative().optional(),
  ratings_average: z.number().min(0).max(5).optional(),
  /** Best-matching edition for the query and lang (e.g. the Portuguese "Duna" of "Dune"). */
  editions: z
    .object({
      docs: z.array(
        z.object({
          key: z
            .string()
            .regex(/^\/books\/OL\d{1,12}M$/)
            .optional(),
          publish_date: z.array(z.string()).optional(),
          number_of_pages: z.number().optional(),
          title: z.string().optional(),
          language: z.array(z.string()).optional(),
          cover_i: z.number().int().positive().optional(),
          isbn: z.array(z.string()).optional(),
          publisher: z.array(z.string()).optional(),
        }),
      ),
    })
    .optional(),
});
const openLibrarySearchSchema = z.object({ docs: z.array(z.unknown()) });

const openLibraryEditionSchema = z.object({
  isbn_10: z.array(z.string()).optional(),
  isbn_13: z.array(z.string()).optional(),
  physical_format: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  authors: z.array(z.object({ key: z.string().regex(/^\/authors\/OL\d{1,12}A$/) })).optional(),
  publishers: z.array(z.string()).optional(),
  publish_date: z.string().optional(),
  number_of_pages: z.number().optional(),
  covers: z.array(z.number()).optional(),
  languages: z.array(z.object({ key: z.string() })).optional(),
});
const openLibraryWorkSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  description: z.union([z.string(), z.object({ value: z.string() })]).optional(),
  covers: z.array(z.number()).optional(),
  first_publish_date: z.string().optional(),
  authors: z
    .array(z.object({ author: z.object({ key: z.string().regex(/^\/authors\/OL\d{1,12}A$/) }) }))
    .optional(),
});
const openLibraryAuthorSchema = z.object({ name: z.string().optional() });

const cachedBookSchema = z.object({ found: z.boolean(), book: catalogBookSchema.optional() });

// ---------------------------------------------------------------- text helpers

function clean(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const text = Array.from(value, (character) => {
    // C0/C1 control characters show up in some Open Library records.
    const code = character.charCodeAt(0);
    return code <= 31 || (code >= 127 && code <= 159) ? ' ' : character;
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
};

/** Google descriptions may contain HTML: keep paragraphs, drop tags, decode common entities. */
export function plainDescription(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/?\s*p\b[^>]*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#?\w+);/g, (entity, name: string) => ENTITIES[name.toLowerCase()] ?? entity)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
  if (!text) return null;
  return text.length > 4000 ? `${text.slice(0, 3999).trimEnd()}…` : text;
}

function cleanAuthors(values: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  const authors: string[] = [];
  for (const value of values ?? []) {
    const name = clean(value, 120);
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      authors.push(name);
    }
  }
  return authors.slice(0, 6);
}

function pages(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= 1 && rounded <= MAX_BOOK_PAGES ? rounded : null;
}

const OPEN_LIBRARY_LANGUAGES: Record<string, string> = {
  por: 'pt',
  eng: 'en',
  spa: 'es',
  fre: 'fr',
  ger: 'de',
  ita: 'it',
};

function language(value: string | undefined): string | null {
  if (!value) return null;
  const code = OPEN_LIBRARY_LANGUAGES[value] ?? value;
  return /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(code) ? code : null;
}

const unique = <T>(values: readonly T[]) => [...new Set(values)];

// ---------------------------------------------------------------- mapping

function googleIsbn13(volume: z.infer<typeof googleVolumeSchema>): string | null {
  const ids = volume.volumeInfo.industryIdentifiers ?? [];
  const isbn13 = ids.find((id) => id.type === 'ISBN_13')?.identifier;
  const isbn10 = ids.find((id) => id.type === 'ISBN_10')?.identifier;
  return toIsbn13(isbn13) ?? toIsbn13(isbn10);
}

function googleCover(volume: z.infer<typeof googleVolumeSchema>): string | null {
  const links = volume.volumeInfo.imageLinks ?? {};
  return hardenCoverUrl(links.thumbnail ?? links.smallThumbnail ?? links.small ?? links.medium);
}

export function mapGoogleVolume(raw: unknown): CatalogBook | null {
  const parsed = googleVolumeSchema.safeParse(raw);
  if (!parsed.success) return null;
  const volume = parsed.data;
  const info = volume.volumeInfo;
  const title = clean(info.title, 300);
  if (!title) return null;
  const isbn13 = googleIsbn13(volume);
  return {
    catalogId: `gb:${volume.id}`,
    title,
    subtitle: clean(info.subtitle, 300),
    authors: cleanAuthors(info.authors),
    publisher: clean(info.publisher, 200),
    publishedYear: parsePublishedYear(info.publishedDate),
    totalPages: pages(info.pageCount),
    isbn13,
    language: language(info.language),
    description: plainDescription(info.description),
    coverUrls: coverCandidates({ coverUrl: googleCover(volume), isbn13 }),
    sources: ['google'],
    edition: 'edition',
  };
}

/** An Open Library work with the taste signals the recommender needs (ADR-031). */
export type OpenLibraryWork = {
  workKey: string;
  book: CatalogBook;
  /** Work title and the selected edition's title (e.g. "Dune" and "Duna"). */
  titles: string[];
  subjects: string[];
  readers: number;
  rating: number | null;
  /** ISBN-13s of the selected edition only. */
  editionIsbns: string[];
  /** Open Library author ids (`OL26320A`), exact for author queries. */
  authorKeys: string[];
};

export function mapOpenLibraryWork(raw: unknown): OpenLibraryWork | null {
  const parsed = openLibraryDocSchema.safeParse(raw);
  const book = mapOpenLibraryDoc(raw);
  if (!parsed.success || !book) return null;
  const doc = parsed.data;
  const edition = doc.editions?.docs[0];
  return {
    workKey: doc.key.slice('/works/'.length),
    book,
    titles: unique([doc.title, edition?.title].filter((title): title is string => Boolean(title))),
    subjects: (doc.subject ?? []).slice(0, 80),
    readers: Math.round(doc.readinglog_count ?? 0),
    rating: doc.ratings_average ?? null,
    editionIsbns: (edition?.isbn ?? []).map(toIsbn13).filter((isbn): isbn is string => !!isbn),
    authorKeys: (doc.author_key ?? []).filter((id) => /^OL\d{1,12}A$/.test(id)).slice(0, 6),
  };
}

export function mapOpenLibraryDoc(raw: unknown): CatalogBook | null {
  const parsed = openLibraryDocSchema.safeParse(raw);
  if (!parsed.success) return null;
  const doc = parsed.data;
  const edition = doc.editions?.docs[0];
  const title = clean(edition?.title ?? doc.title, 300);
  if (!title) return null;
  // Keep the selected edition's identity; a work's ISBN list is never edition evidence.
  const isbn13 = (edition?.isbn ?? []).map((value) => toIsbn13(value)).find(Boolean) ?? null;
  const languages = edition?.language ?? [];
  const covers = [
    edition?.cover_i ? openLibraryCoverById(edition.cover_i) : null,
    !edition && doc.cover_i ? openLibraryCoverById(doc.cover_i) : null,
  ].filter((url): url is string => url !== null);
  return {
    catalogId: edition?.key
      ? `ol:${edition.key.slice('/books/'.length)}`
      : `ol:${doc.key.slice('/works/'.length)}`,
    title,
    subtitle: edition?.title ? null : clean(doc.subtitle, 300),
    authors: cleanAuthors(doc.author_name),
    publisher: clean(edition?.publisher?.[0], 200),
    publishedYear: parsePublishedYear(edition?.publish_date?.[0]),
    totalPages: pages(edition?.number_of_pages),
    isbn13,
    language: languages.length === 1 ? language(languages[0]) : null,
    description: null,
    coverUrls: unique(covers),
    sources: ['openlibrary'],
    edition: edition?.key ? 'edition' : 'work',
  };
}
/** Fills gaps in `base` from `other` and unions covers/sources. `base` keeps its id and title. */
export function mergeBooks(base: CatalogBook, other: CatalogBook): CatalogBook {
  return {
    ...base,
    subtitle: base.subtitle ?? other.subtitle,
    authors: base.authors.length ? base.authors : other.authors,
    publisher: base.publisher ?? other.publisher,
    publishedYear: base.publishedYear ?? other.publishedYear,
    totalPages: base.totalPages ?? other.totalPages,
    isbn13: base.isbn13 ?? other.isbn13,
    language: base.language ?? other.language,
    format: base.format ?? other.format,
    description: base.description ?? other.description,
    coverUrls: orderCovers([...base.coverUrls, ...other.coverUrls]),
    sources: unique([...base.sources, ...other.sources]),
  };
}

/** Known covers first; "cover by ISBN" guesses (may 404) last. At most 4. */
function orderCovers(urls: readonly string[]): string[] {
  const all = unique(urls);
  const guesses = all.filter((url) => url.includes('/b/isbn/'));
  return [...all.filter((url) => !url.includes('/b/isbn/')), ...guesses].slice(0, 4);
}

/**
 * Merges ranked lists (first list wins ties) into one de-duplicated list: same ISBN-13 or same
 * confirmed edition identity. Different formats, ISBNs and languages remain separate.
 */
export function mergeResults(lists: readonly CatalogBook[][], limit: number): CatalogBook[] {
  const merged: CatalogBook[] = [];
  for (const book of lists.flat()) {
    const at = merged.findIndex((other) => sameEdition(other, book));
    if (at >= 0 && merged[at]) merged[at] = mergeBooks(merged[at], book);
    else merged.push(book);
  }
  return merged.slice(0, limit);
}

/** Missing edition metadata is not evidence that two editions are interchangeable. */
export function sameEdition(a: CatalogBook, b: CatalogBook): boolean {
  if (a.catalogId === b.catalogId) return true;
  if (a.isbn13 || b.isbn13) return Boolean(a.isbn13 && a.isbn13 === b.isbn13);
  return Boolean(
    a.authors.length &&
    b.authors.length &&
    a.publisher &&
    b.publisher &&
    a.publishedYear &&
    b.publishedYear &&
    a.language &&
    b.language &&
    foldText(a.title) === foldText(b.title) &&
    foldText(a.authors.join(' ')) === foldText(b.authors.join(' ')) &&
    foldText(a.publisher) === foldText(b.publisher) &&
    a.publishedYear === b.publishedYear &&
    a.language === b.language &&
    a.format === b.format,
  );
}

/** Small explicit language hints; ambiguous titles use the app's Portuguese locale. No translation. */
export function queryLanguage(query: string): string {
  const words = new Set(foldText(query).split(' '));
  if (['the', 'and', 'of', 'with', 'for'].some((word) => words.has(word))) return 'en';
  if (['el', 'los', 'las', 'una', 'del'].some((word) => words.has(word))) return 'es';
  if (['le', 'les', 'une', 'des'].some((word) => words.has(word))) return 'fr';
  return 'pt';
}

/** Strong title/author token coverage; remaining suggestions are explicitly approximate. */
export function strongMatch(book: CatalogBook, query: string): boolean {
  const words = foldText(query.replace(/^(?:title|author|intitle|inauthor):/i, ''))
    .split(' ')
    .filter(Boolean);
  const haystack = new Set(foldText(`${book.title} ${book.authors.join(' ')}`).split(' '));
  return words.length > 0 && words.every((word) => haystack.has(word));
}

/**
 * Relevance on top of the sources' own order: title matches first (exact > starts with > all
 * words), then author matches, then Portuguese editions and books with a cover. Results that match
 * none of the words go last. subject: browsing keeps the sources' order.
 */
export function rankResults(
  books: readonly CatalogBook[],
  query: string,
  popularity: ReadonlyMap<string, number> = new Map(),
): CatalogBook[] {
  if (/^subject:/i.test(query.trim())) return [...books];
  const q = foldText(query.replace(/^(?:title|author|intitle|inauthor):/i, ''));
  const words = q.split(' ').filter((word) => word.length > 1);
  const scored = books.map((book, index) => {
    const title = foldText(book.title);
    const authors = foldText(book.authors.join(' '));
    let score = strongMatch(book, query) ? 200 : 0;
    if (title === q) score += 100;
    else if (title.startsWith(q)) score += 60;
    const titleHits = words.filter((word) => title.includes(word)).length;
    const authorHits = words.filter((word) => authors.includes(word)).length;
    if (words.length && titleHits === words.length) score += 40;
    score += titleHits * 8 + authorHits * 6;
    if (titleHits + authorHits === 0) score -= 200;
    if (book.language?.startsWith(queryLanguage(query))) score += 12;
    if (book.coverUrls.length) score += 10;
    if (book.authors.length) score += 4;
    // Widely published works (many editions) are usually what the reader means.
    const editions = popularity.get(workMatchKey(book.title, book.authors)) ?? 0;
    score += Math.min(30, Math.round(5 * Math.log2(1 + editions)));
    return { book, score, index };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((entry) => entry.book);
}

// ---------------------------------------------------------------- service

type SourceResult = {
  status: 'ok' | 'error' | 'skipped';
  books: CatalogBook[];
  /** Work match key → edition count (Open Library's popularity signal). */
  popularity?: Map<string, number>;
};

export class CatalogService {
  private readonly transport: CatalogTransport;

  constructor(private readonly options: CatalogServiceOptions) {
    this.transport = new CatalogTransport({ ...options, timeoutMs: options.timeoutMs ?? 6000 });
  }

  private getJson(url: string, source: CatalogSource): Promise<Fetched> {
    return this.transport.get(url, source);
  }

  async cacheCover(book: CatalogBook): Promise<CatalogBook> {
    if (!this.options.covers) return book;
    const task = this.options.covers.ingest(book.coverUrls).then(async (url) => {
      if (!url) return book;
      const covered = this.coveredBook(book, url);
      await this.writeBook(book.catalogId, { ...covered, match: undefined });
      return covered;
    });
    if (!this.options.background) return task;
    this.options.background(task.catch(() => undefined));
    return this.withinCoverWindow(task, () => book);
  }

  private async withinCoverWindow<T>(task: Promise<T>, fallbackValue: () => T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fallback = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallbackValue()), COVER_REUSE_WAIT_MS);
    });
    try {
      return await Promise.race([task, fallback]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private coveredBook(book: CatalogBook, url: string): CatalogBook {
    return {
      ...book,
      cachedCoverUrl: url,
      coverUrls: unique([url, ...book.coverUrls]).slice(0, 4),
    };
  }

  private googleUrl(path: string, params: Record<string, string>): string {
    const query = new URLSearchParams(params);
    if (this.options.googleApiKey) query.set('key', this.options.googleApiKey);
    return `${GOOGLE}${path}?${query.toString()}`;
  }

  private async searchGoogle(q: string, limit: number): Promise<SourceResult> {
    // Keyless Google is best-effort (its shared quota is often zero): while it is backing off, it
    // is skipped rather than reported as a failure that would label every search "partial".
    if (!this.options.googleApiKey && (await this.transport.backingOff('google'))) {
      return { status: 'skipped', books: [] };
    }
    const result = await this.getJson(
      this.googleUrl('/volumes', {
        q,
        maxResults: String(Math.min(limit + 10, 40)),
        printType: 'books',
        // Workers egress IPs may not geolocate; Google rejects "unknown country" without this.
        country: 'BR',
      }),
      'google',
    );
    if (!result.ok) {
      return { status: 'error', books: [] };
    }
    const list = googleListSchema.safeParse(result.data);
    if (!list.success) return { status: 'error', books: [] };
    const books = (list.data.items ?? [])
      .slice(0, 40)
      .map(mapGoogleVolume)
      .filter((book): book is CatalogBook => book !== null);
    return { status: 'ok', books };
  }

  private async searchOpenLibrary(q: string, limit: number): Promise<SourceResult> {
    const params = new URLSearchParams({
      q,
      limit: String(Math.min(limit + 10, 40)),
      // Prefer Portuguese editions' titles when a work has them.
      lang: queryLanguage(q),
      fields:
        'key,title,subtitle,author_name,cover_i,language,edition_count,editions,editions.key,editions.title,editions.language,editions.cover_i,editions.isbn,editions.publisher,editions.publish_date,editions.number_of_pages',
    });
    const result = await this.getJson(
      `${OPEN_LIBRARY}/search.json?${params.toString()}`,
      'openlibrary',
    );
    if (!result.ok) return { status: 'error', books: [] };
    const list = openLibrarySearchSchema.safeParse(result.data);
    if (!list.success) return { status: 'error', books: [] };
    const books: CatalogBook[] = [];
    const popularity = new Map<string, number>();
    for (const raw of list.data.docs.slice(0, 40)) {
      const book = mapOpenLibraryDoc(raw);
      if (!book) continue;
      books.push(book);
      const count = openLibraryDocSchema.safeParse(raw).data?.edition_count ?? 0;
      popularity.set(workMatchKey(book.title, book.authors), count);
    }
    return { status: 'ok', books, popularity };
  }

  /**
   * Open Library work search with Portuguese edition selection (`lang=pt`), for Discover. Raw
   * Solr syntax: callers build `q` only from folded text, ids and fixed field names.
   */
  async openLibraryWorks(params: {
    q: string;
    limit: number;
    sort?: 'readinglog' | 'rating';
  }): Promise<{ status: 'ok' | 'error'; works: OpenLibraryWork[] }> {
    const query = new URLSearchParams({
      q: params.q,
      limit: String(Math.min(params.limit, 100)),
      lang: 'pt',
      fields:
        'key,title,subtitle,author_name,author_key,cover_i,language,edition_count,subject,readinglog_count,ratings_average,editions,editions.key,editions.title,editions.language,editions.cover_i,editions.isbn,editions.publisher,editions.publish_date,editions.number_of_pages',
    });
    if (params.sort) query.set('sort', params.sort);
    const result = await this.getJson(
      `${OPEN_LIBRARY}/search.json?${query.toString()}`,
      'openlibrary',
    );
    if (!result.ok) return { status: 'error', works: [] };
    const list = openLibrarySearchSchema.safeParse(result.data);
    if (!list.success) return { status: 'error', works: [] };
    const works = list.data.docs
      .slice(0, 100)
      .map(mapOpenLibraryWork)
      .filter((work): work is OpenLibraryWork => work !== null);
    return { status: 'ok', works };
  }

  /** Cover-cache metadata for books built outside search (Discover). */
  withCachedCovers(books: CatalogBook[]): Promise<CatalogBook[]> {
    return this.cachedCovers({
      query: '',
      results: books,
      sources: { google: 'skipped', openlibrary: 'ok' },
    }).then((response) => response.results);
  }

  /** Free-text search. ISBN-like input must pass its checksum before reaching any source. */
  async search(rawQuery: string, limit: number): Promise<CatalogSearchResponse> {
    const q = rawQuery.normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (/^(?:\d{9}[\dX]|\d{13})$/.test(normalizeIsbn(q)) && !toIsbn13(q)) {
      throw new AppError('VALIDATION_FAILED', 'Invalid ISBN checksum.');
    }
    const isbn13 = toIsbn13(q);
    if (isbn13) return this.cachedCovers({ ...(await this.isbnSearch(isbn13)), query: q });
    // Open Library answers 422 under 3 characters and keyless Google may be out of quota: such
    // short text (older builds search from 2) is an honest empty result, never a 503.
    if (
      foldText(q.replace(/^(?:title|author|intitle|inauthor):/i, '')).length <
      MIN_CATALOG_QUERY_LENGTH
    ) {
      return {
        query: q,
        results: [],
        sources: { google: 'skipped', openlibrary: 'skipped', brasilapi: 'skipped' },
      };
    }
    const cacheKey = `search:${CACHE_VERSION}:${q.toLowerCase()}:${limit}`;
    const cached = await this.readSearch(cacheKey);
    if (cached) return this.cachedCovers({ ...cached, query: q });
    const inFlight =
      searches.get(this.options.cache) ?? new Map<string, Promise<CatalogSearchResponse>>();
    searches.set(this.options.cache, inFlight);
    const pending = inFlight.get(cacheKey);
    if (pending) return this.cachedCovers({ ...(await pending), query: q });
    const task = this.freshSearch(q, limit, cacheKey);
    inFlight.set(cacheKey, task);
    try {
      return await this.cachedCovers({ ...(await task), query: q });
    } finally {
      if (inFlight.get(cacheKey) === task) inFlight.delete(cacheKey);
    }
  }

  private async freshSearch(q: string, limit: number, cacheKey: string) {
    const { google, openLibrary, remaining } = await this.searchSources(q, limit);
    const response = this.searchResponse(q, limit, google, openLibrary);
    await this.storeSearch(cacheKey, response, Boolean(remaining));
    if (remaining) {
      const warming = remaining.then(async ([fullGoogle, fullOpenLibrary]) => {
        const full = this.searchResponse(q, limit, fullGoogle, fullOpenLibrary);
        await this.storeSearch(cacheKey, full);
      });
      this.options.background?.(warming.catch(() => undefined));
    }
    return response;
  }

  private async searchSources(q: string, limit: number) {
    // Without a runtime scheduler, keep the complete awaitable behavior for standalone callers.
    if (!this.options.background) {
      const [google, openLibrary] = await Promise.all([
        this.searchWithFallback(q, limit, 'google'),
        this.searchWithFallback(q, limit, 'openlibrary'),
      ]);
      return { google, openLibrary, remaining: undefined };
    }
    type Source = 'google' | 'openlibrary';
    const latest: Record<Source, SourceResult> = {
      google: { status: 'error', books: [] },
      openlibrary: { status: 'error', books: [] },
    };
    const settled = new Set<Source>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let release: (() => void) | undefined;
    const useful = new Promise<void>((resolve) => {
      release = resolve;
    });
    const progress = (source: Source, result: SourceResult) => {
      latest[source] = result;
      if (result.books.length && timer === undefined) {
        timer = setTimeout(() => release?.(), SEARCH_MERGE_WAIT_MS);
      }
    };
    const run = (source: Source) =>
      this.searchWithFallback(q, limit, source, (result) => progress(source, result)).then(
        (result) => {
          progress(source, result);
          settled.add(source);
          return result;
        },
      );
    const complete = Promise.all([run('google'), run('openlibrary')]);
    try {
      const finished = await Promise.race([complete.then(() => true), useful.then(() => false)]);
      const snapshot = (source: Source): SourceResult => ({
        ...latest[source],
        books: [...latest[source].books],
        popularity: latest[source].popularity ? new Map(latest[source].popularity) : undefined,
        status: settled.has(source) ? latest[source].status : 'error',
      });
      return {
        google: snapshot('google'),
        openLibrary: snapshot('openlibrary'),
        remaining: finished ? undefined : complete,
      };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private searchResponse(
    q: string,
    limit: number,
    google: SourceResult,
    openLibrary: SourceResult,
  ): CatalogSearchResponse {
    if (
      (google.status === 'error' || openLibrary.status === 'error') &&
      !google.books.length &&
      !openLibrary.books.length
    ) {
      throw new AppError('SERVICE_UNAVAILABLE', 'The book catalog is unavailable right now.');
    }
    return {
      query: q,
      results: rankResults(
        mergeResults([google.books, openLibrary.books], Infinity),
        q,
        openLibrary.popularity,
      )
        .slice(0, limit)
        .map((book) => ({
          ...book,
          match: /^subject:/i.test(q) || strongMatch(book, q) ? 'exact' : 'approximate',
        })),
      sources: { google: google.status, openlibrary: openLibrary.status, brasilapi: 'skipped' },
    };
  }

  private async storeSearch(cacheKey: string, response: CatalogSearchResponse, warming = false) {
    const partial = Object.values(response.sources).some((status) => status === 'error');
    await this.options.cache.set(
      cacheKey,
      response,
      warming || !response.results.length ? 60 : partial ? TTL.partialSearch : TTL.search,
    );
    // Google search includes volume metadata. Open Library editions need their own detail read.
    await Promise.all(
      response.results
        .filter((book) => book.catalogId.startsWith('gb:'))
        .map((book) => this.writeBook(book.catalogId, { ...book, match: undefined })),
    );
  }

  private async cachedCovers(response: CatalogSearchResponse): Promise<CatalogSearchResponse> {
    if (!this.options.covers || !response.results.length) return response;
    const covers = this.options.covers;
    const results = [...response.results];
    const task = Promise.all(
      response.results.map(async (book, index) => {
        const url = await covers.cached(book.coverUrls).catch(() => null);
        if (url) results[index] = this.coveredBook(book, url);
      }),
    ).then(() => ({ ...response, results }));
    this.options.background?.(task.catch(() => undefined));
    // One budget for the whole batch. Keep ready covers even when another metadata read stalls.
    return this.withinCoverWindow(task, () => ({ ...response, results: [...results] }));
  }

  private async readSearch(key: string): Promise<CatalogSearchResponse | null> {
    const hit = await this.options.cache.get(key);
    if (hit === undefined) return null;
    const parsed = z
      .object({
        query: z.string(),
        results: z.array(catalogBookSchema),
        sources: z.object({
          google: z.enum(['ok', 'error', 'skipped']),
          openlibrary: z.enum(['ok', 'error', 'skipped']),
          brasilapi: z.enum(['ok', 'error', 'skipped']).optional(),
        }),
      })
      .safeParse(hit);
    return parsed.success ? parsed.data : null;
  }

  private async writeBook(catalogId: string, book: CatalogBook | null) {
    await this.options.cache.set(
      `book:${CACHE_VERSION}:${catalogId}`,
      book ? { found: true, book } : { found: false },
      book ? TTL.book : TTL.notFound,
    );
  }

  /** A book by catalog id, or null when no source knows it. Throws 503 when sources are down. */
  async getBook(catalogId: string): Promise<CatalogBook | null> {
    if (!isCatalogId(catalogId)) return null;
    if (catalogId.startsWith('isbn:')) {
      const isbn = toIsbn13(catalogId.slice(5));
      return isbn ? this.fetchIsbn(isbn) : null;
    }
    const hit = cachedBookSchema.safeParse(
      await this.options.cache.get(`book:${CACHE_VERSION}:${catalogId}`),
    );
    if (hit.success) return hit.data.found ? (hit.data.book ?? null) : null;

    const [kind, id = ''] = catalogId.split(':') as [string, string | undefined];
    let book: CatalogBook | null;
    if (kind === 'gb') book = await this.fetchGoogleVolume(id);
    else
      book = id.endsWith('M')
        ? await this.fetchEdition(`${OPEN_LIBRARY}/books/${id}.json`, null, `ol:${id}`)
        : await this.fetchOpenLibraryWork(id);
    await this.writeBook(catalogId, book);
    return book;
  }

  /** ISBN-10/13 lookup (barcode scanner). */
  async lookupIsbn(rawIsbn: string): Promise<CatalogBook | null> {
    const isbn13 = toIsbn13(rawIsbn);
    return isbn13 ? this.getBook(`isbn:${isbn13}`) : null;
  }

  private async fetchGoogleVolume(id: string): Promise<CatalogBook | null> {
    const result = await this.getJson(
      this.googleUrl(`/volumes/${id}`, { country: 'BR' }),
      'google',
    );
    if (!result.ok) {
      if (result.status === 404 || result.status === 400) return null;
      throw new AppError('SERVICE_UNAVAILABLE', 'The book catalog is unavailable right now.');
    }
    return mapGoogleVolume(result.data);
  }

  private async searchWithFallback(
    q: string,
    limit: number,
    source: 'google' | 'openlibrary',
    onResult?: (result: SourceResult) => void,
  ): Promise<SourceResult> {
    const search = (value: string) =>
      source === 'google' ? this.searchGoogle(value, limit) : this.searchOpenLibrary(value, limit);
    const primary =
      source === 'google'
        ? q.replace(/^title:/i, 'intitle:').replace(/^author:/i, 'inauthor:')
        : q.replace(/^intitle:/i, 'title:').replace(/^inauthor:/i, 'author:');
    const first = await search(primary);
    onResult?.(first);
    // Alternatives cost another paced upstream call: only when the first answer is thin.
    if (
      first.status !== 'ok' ||
      /^subject:/i.test(q) ||
      first.books.length >= 8 ||
      first.books.some((book) => strongMatch(book, q))
    )
      return first;
    const normalized = foldText(q.replace(/^(?:title|author|intitle|inauthor):/i, ''));
    const alternatives =
      source === 'google'
        ? [`intitle:"${normalized}"`, `inauthor:"${normalized}"`]
        : [`title:(${normalized}) OR author:(${normalized})`];
    for (const alternate of alternatives) {
      const next = await search(alternate);
      first.books.push(...next.books);
      if (next.popularity)
        first.popularity = new Map([...(first.popularity ?? []), ...next.popularity]);
      onResult?.(first);
      if (next.status !== 'ok') return { ...first, status: 'error' };
      if (next.books.some((book) => strongMatch(book, q))) break;
    }
    return first;
  }

  private async fetchIsbn(isbn13: string): Promise<CatalogBook | null> {
    const response = await this.isbnSearch(isbn13);
    if (
      !response.results.length &&
      Object.values(response.sources).some((status) => status === 'error')
    ) {
      throw new AppError('SERVICE_UNAVAILABLE', 'Some ISBN sources are unavailable. Please retry.');
    }
    return response.results[0] ?? null;
  }

  private async isbnSearch(isbn13: string): Promise<CatalogSearchResponse> {
    const key = `isbn:${CACHE_VERSION}:${isbn13}`;
    const hit = await this.readSearch(key);
    if (hit) return hit;
    const [google, openlibrary, brasilapi] = await Promise.all([
      this.isbnGoogle(isbn13),
      this.isbnOpenLibrary(isbn13),
      this.isbnBrasil(isbn13),
    ]);
    const response: CatalogSearchResponse = {
      query: isbn13,
      results: mergeResults([brasilapi.books, openlibrary.books, google.books], 1).map((book) => ({
        ...book,
        catalogId: `isbn:${isbn13}`,
        match: 'exact',
      })),
      sources: {
        google: google.status,
        openlibrary: openlibrary.status,
        brasilapi: brasilapi.status,
      },
    };
    if (
      !response.results.length &&
      [google, openlibrary, brasilapi].some((result) => result.status === 'error')
    ) {
      throw new AppError('SERVICE_UNAVAILABLE', 'The book catalog is unavailable right now.');
    }
    const partial = Object.values(response.sources).some((status) => status === 'error');
    // A partial miss must never become an authoritative negative cache entry.
    if (response.results.length || !partial)
      await this.options.cache.set(
        key,
        response,
        partial ? 60 : response.results.length ? TTL.book : 300,
      );
    return response;
  }

  private async isbnGoogle(isbn13: string): Promise<SourceResult> {
    let result = await this.searchGoogle(`isbn:${isbn13}`, 10);
    let books = result.books.filter((book) => book.isbn13 === isbn13);
    const isbn10 = toIsbn10(isbn13);
    if (!books.length && result.status === 'ok' && isbn10) {
      result = await this.searchGoogle(`isbn:${isbn10}`, 10);
      books = result.books.filter((book) => book.isbn13 === isbn13);
    }
    return { status: result.status, books };
  }

  private async isbnOpenLibrary(isbn13: string): Promise<SourceResult> {
    try {
      let book = await this.fetchEdition(
        `${OPEN_LIBRARY}/isbn/${isbn13}.json`,
        isbn13,
        `isbn:${isbn13}`,
      );
      const isbn10 = toIsbn10(isbn13);
      if (!book && isbn10)
        book = await this.fetchEdition(
          `${OPEN_LIBRARY}/isbn/${isbn10}.json`,
          isbn13,
          `isbn:${isbn13}`,
        );
      return { status: 'ok', books: book ? [book] : [] };
    } catch {
      return { status: 'error', books: [] };
    }
  }

  private async fetchEdition(
    url: string,
    requested: string | null,
    catalogId: string,
  ): Promise<CatalogBook | null> {
    const response = await this.getJson(url, 'openlibrary');
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new AppError('SERVICE_UNAVAILABLE', 'Open Library is unavailable.');
    }
    const parsed = openLibraryEditionSchema.safeParse(response.data);
    if (!parsed.success) throw new AppError('SERVICE_UNAVAILABLE', 'Invalid edition response.');
    const data = parsed.data;
    const title = clean(data.title, 300);
    const identifiers = [...(data.isbn_13 ?? []), ...(data.isbn_10 ?? [])]
      .map(toIsbn13)
      .filter((isbn): isbn is string => isbn !== null);
    if (!title || (requested && !identifiers.includes(requested))) return null;
    const isbn13 = requested ?? identifiers[0] ?? null;
    const coverId = data.covers?.find((id) => Number.isInteger(id) && id > 0);
    return {
      catalogId,
      title,
      subtitle: clean(data.subtitle, 300),
      authors: cleanAuthors(await this.authorNames((data.authors ?? []).map((a) => a.key))),
      publisher: clean(data.publishers?.[0], 200),
      publishedYear: parsePublishedYear(data.publish_date),
      totalPages: pages(data.number_of_pages),
      isbn13,
      language: language(data.languages?.[0]?.key.split('/').pop()),
      description: null,
      coverUrls: coverCandidates({
        coverUrl: coverId ? openLibraryCoverById(coverId) : null,
        isbn13,
      }),
      sources: ['openlibrary'],
      edition: 'edition',
      format: clean(data.physical_format, 80),
    };
  }

  private async isbnBrasil(isbn13: string): Promise<SourceResult> {
    if (!/^978(?:65|85)/.test(isbn13)) return { status: 'skipped', books: [] };
    const result = await this.getJson(
      `https://brasilapi.com.br/api/isbn/v1/${isbn13}?providers=cbl,mercado-editorial`,
      'brasilapi',
    );
    if (!result.ok) return { status: result.status === 404 ? 'ok' : 'error', books: [] };
    const parsed = z
      .object({
        isbn: z.string(),
        title: z.string(),
        authors: z.array(z.string()).nullish(),
        subtitle: z.string().nullish(),
        publisher: z.string().nullish(),
        year: z.number().nullish(),
        page_count: z.number().nullish(),
        synopsis: z.string().nullish(),
        cover_url: z.string().nullish(),
        format: z.string().nullish(),
      })
      .safeParse(result.data);
    if (!parsed.success) return { status: 'error', books: [] };
    const data = parsed.data;
    const title = clean(data.title, 300);
    if (toIsbn13(data.isbn) !== isbn13 || !title) return { status: 'ok', books: [] };
    return {
      status: 'ok',
      books: [
        {
          catalogId: `isbn:${isbn13}`,
          title,
          subtitle: clean(data.subtitle, 300),
          authors: cleanAuthors(data.authors ?? undefined),
          publisher: clean(data.publisher, 200),
          publishedYear: parsePublishedYear(data.year),
          totalPages: pages(data.page_count ?? undefined),
          isbn13,
          language: null,
          description: plainDescription(data.synopsis),
          coverUrls: coverCandidates({ coverUrl: data.cover_url ?? null, isbn13 }),
          sources: ['brasilapi'],
          edition: 'edition',
          format: clean(data.format, 80),
        },
      ],
    };
  }

  private async authorNames(keys: readonly string[]): Promise<string[]> {
    const names = await Promise.all(
      keys.slice(0, 3).map(async (key) => {
        const author = await this.getJson(`${OPEN_LIBRARY}${key}.json`, 'openlibrary');
        const parsed = author.ok ? openLibraryAuthorSchema.safeParse(author.data) : null;
        return parsed?.success ? (parsed.data.name ?? '') : '';
      }),
    );
    return names.filter(Boolean);
  }

  private async fetchOpenLibraryWork(workId: string): Promise<CatalogBook | null> {
    const result = await this.getJson(`${OPEN_LIBRARY}/works/${workId}.json`, 'openlibrary');
    if (!result.ok) {
      if (result.status === 404) return null;
      throw new AppError('SERVICE_UNAVAILABLE', 'The book catalog is unavailable right now.');
    }
    const work = openLibraryWorkSchema.safeParse(result.data);
    if (!work.success) return null;
    const title = clean(work.data.title, 300);
    if (!title) return null;

    const names = await this.authorNames(
      (work.data.authors ?? []).map((entry) => entry.author.key),
    );
    const description = work.data.description;
    const coverId = work.data.covers?.find((id) => Number.isInteger(id) && id > 0);
    return {
      catalogId: `ol:${workId}`,
      title,
      subtitle: clean(work.data.subtitle, 300),
      authors: cleanAuthors(names.filter(Boolean)),
      publisher: null,
      publishedYear: null,
      totalPages: null,
      isbn13: null,
      language: null,
      description: plainDescription(
        typeof description === 'string' ? description : description?.value,
      ),
      coverUrls: coverId ? [openLibraryCoverById(coverId)] : [],
      sources: ['openlibrary'],
      edition: 'work',
    };
  }
}
