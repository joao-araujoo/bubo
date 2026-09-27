import { type CatalogBook, catalogBookSchema, type CatalogSearchResponse } from '@bubo/contracts';
import {
  type CatalogSource,
  coverCandidates,
  foldText,
  hardenCoverUrl,
  isCatalogId,
  MAX_BOOK_PAGES,
  openLibraryCoverById,
  parsePublishedYear,
  toIsbn13,
  workMatchKey,
} from '@bubo/domain';
import { z } from 'zod';

import { AppError } from '../lib/errors';
import { type Logger } from '../lib/logger';
import { API_VERSION } from '../version';
import { type CatalogCache } from './catalog-cache';

/**
 * Book catalog (ADR-016): Google Books + Open Library, queried in parallel with timeouts, merged
 * and de-duplicated. Every upstream payload is validated with lenient Zod schemas and every cover
 * URL is hardened (https + allowlisted hosts). Results are cached (search 24 h, books 7 days).
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type CatalogServiceOptions = {
  fetch: FetchLike;
  cache: CatalogCache;
  googleApiKey?: string;
  timeoutMs?: number;
  logger?: Logger;
};

const GOOGLE = 'https://www.googleapis.com/books/v1';
const OPEN_LIBRARY = 'https://openlibrary.org';
const CACHE_VERSION = 'v1';
const TTL = {
  search: 24 * 60 * 60,
  partialSearch: 10 * 60,
  book: 7 * 24 * 60 * 60,
  notFound: 60 * 60,
  googleBackoff: 10 * 60,
} as const;
const GOOGLE_BACKOFF_KEY = `backoff:${CACHE_VERSION}:google`;

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
const googleListSchema = z.object({ items: z.array(z.unknown()).optional() });

const openLibraryDocSchema = z.object({
  key: z.string().regex(/^\/works\/OL\d{1,12}W$/),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  author_name: z.array(z.string()).optional(),
  first_publish_year: z.number().optional(),
  cover_i: z.number().int().positive().optional(),
  number_of_pages_median: z.number().optional(),
  publisher: z.array(z.string()).optional(),
  language: z.array(z.string()).optional(),
  edition_count: z.number().int().nonnegative().optional(),
  /** Best-matching edition for the query and lang (e.g. the Portuguese "Duna" of "Dune"). */
  editions: z
    .object({
      docs: z.array(
        z.object({
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
  };
}

export function mapOpenLibraryDoc(raw: unknown): CatalogBook | null {
  const parsed = openLibraryDocSchema.safeParse(raw);
  if (!parsed.success) return null;
  const doc = parsed.data;
  const edition = doc.editions?.docs[0];
  const title = clean(edition?.title ?? doc.title, 300);
  if (!title) return null;
  // An edition with an ISBN is a concrete book: key it by ISBN so details show that edition.
  const isbn13 = (edition?.isbn ?? []).map((value) => toIsbn13(value)).find(Boolean) ?? null;
  const languages = edition?.language ?? doc.language ?? [];
  const covers = [
    edition?.cover_i ? openLibraryCoverById(edition.cover_i) : null,
    doc.cover_i ? openLibraryCoverById(doc.cover_i) : null,
  ].filter((url): url is string => url !== null);
  return {
    catalogId: isbn13 ? `isbn:${isbn13}` : `ol:${doc.key.slice('/works/'.length)}`,
    title,
    subtitle: edition?.title ? null : clean(doc.subtitle, 300),
    authors: cleanAuthors(doc.author_name),
    publisher: clean(edition?.publisher?.[0] ?? doc.publisher?.[0], 200),
    publishedYear: parsePublishedYear(doc.first_publish_year),
    totalPages: pages(doc.number_of_pages_median),
    isbn13,
    language: languages.length === 1 ? language(languages[0]) : null,
    description: null,
    coverUrls: unique(covers),
    sources: ['openlibrary'],
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
 * work (folded title + first author's last name). Books with a cover come first (stable).
 */
export function mergeResults(lists: readonly CatalogBook[][], limit: number): CatalogBook[] {
  const merged: CatalogBook[] = [];
  const index = new Map<string, number>();
  for (const list of lists) {
    for (const book of list) {
      const keys = [
        `w:${workMatchKey(book.title, book.authors)}`,
        ...(book.isbn13 ? [`i:${book.isbn13}`] : []),
      ];
      const at = keys.map((key) => index.get(key)).find((value) => value !== undefined);
      if (at !== undefined) {
        const current = merged[at];
        if (current) merged[at] = mergeBooks(current, book);
        for (const key of keys) index.set(key, at);
        continue;
      }
      merged.push(book);
      for (const key of keys) index.set(key, merged.length - 1);
    }
  }
  const withCover = merged.filter((book) => book.coverUrls.length > 0);
  const withoutCover = merged.filter((book) => book.coverUrls.length === 0);
  return [...withCover, ...withoutCover].slice(0, limit);
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
  const q = foldText(query);
  const words = q.split(' ').filter((word) => word.length > 1);
  const scored = books.map((book, index) => {
    const title = foldText(book.title);
    const authors = foldText(book.authors.join(' '));
    let score = 0;
    if (title === q) score += 100;
    else if (title.startsWith(q)) score += 60;
    const titleHits = words.filter((word) => title.includes(word)).length;
    const authorHits = words.filter((word) => authors.includes(word)).length;
    if (words.length && titleHits === words.length) score += 40;
    score += titleHits * 8 + authorHits * 6;
    if (titleHits + authorHits === 0) score -= 200;
    if (book.language?.startsWith('pt')) score += 12;
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

type Fetched = { ok: true; data: unknown } | { ok: false; status: number };
type SourceResult = {
  status: 'ok' | 'error' | 'skipped';
  books: CatalogBook[];
  /** Work match key → edition count (Open Library's popularity signal). */
  popularity?: Map<string, number>;
};

export class CatalogService {
  private readonly timeoutMs: number;

  constructor(private readonly options: CatalogServiceOptions) {
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  private async getJson(url: string, source: CatalogSource): Promise<Fetched> {
    try {
      const response = await this.options.fetch(url, {
        headers: {
          accept: 'application/json',
          // Open Library asks API clients to identify themselves.
          'user-agent': `Bubo/${API_VERSION} (reading app; catalog lookups)`,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) {
        if (response.status !== 404) {
          this.options.logger?.warn('catalog source failed', { source, status: response.status });
        }
        return { ok: false, status: response.status };
      }
      return { ok: true, data: await response.json() };
    } catch (error) {
      this.options.logger?.warn('catalog source unreachable', {
        source,
        reason: error instanceof Error ? error.name : 'unknown',
      });
      return { ok: false, status: 0 };
    }
  }

  private googleUrl(path: string, params: Record<string, string>): string {
    const query = new URLSearchParams(params);
    if (this.options.googleApiKey) query.set('key', this.options.googleApiKey);
    return `${GOOGLE}${path}?${query.toString()}`;
  }

  private async searchGoogle(q: string, limit: number): Promise<SourceResult> {
    if (!(await this.googleAvailable())) return { status: 'skipped', books: [] };
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
      await this.noteGoogleFailure(result.status);
      return { status: 'error', books: [] };
    }
    const list = googleListSchema.safeParse(result.data);
    if (!list.success) return { status: 'error', books: [] };
    const books = (list.data.items ?? [])
      .map(mapGoogleVolume)
      .filter((book): book is CatalogBook => book !== null);
    return { status: 'ok', books };
  }

  private async searchOpenLibrary(q: string, limit: number): Promise<SourceResult> {
    const params = new URLSearchParams({
      q,
      limit: String(Math.min(limit + 10, 40)),
      // Prefer Portuguese editions' titles when a work has them.
      lang: 'pt',
      fields:
        'key,title,subtitle,author_name,first_publish_year,cover_i,number_of_pages_median,publisher,language,edition_count,editions,editions.title,editions.language,editions.cover_i,editions.isbn,editions.publisher',
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
    for (const raw of list.data.docs) {
      const book = mapOpenLibraryDoc(raw);
      if (!book) continue;
      books.push(book);
      const count = openLibraryDocSchema.safeParse(raw).data?.edition_count ?? 0;
      popularity.set(workMatchKey(book.title, book.authors), count);
    }
    return { status: 'ok', books, popularity };
  }

  /** Free-text search. A query that is a valid ISBN becomes an ISBN lookup. */
  async search(rawQuery: string, limit: number): Promise<CatalogSearchResponse> {
    const q = rawQuery.trim().replace(/\s+/g, ' ');
    const cacheKey = `search:${CACHE_VERSION}:${q.toLowerCase()}:${limit}`;
    const cached = await this.readSearch(cacheKey);
    if (cached) return cached;

    const isbn13 = toIsbn13(q);
    let response: CatalogSearchResponse;
    if (isbn13) {
      const found = await this.lookupIsbn(isbn13);
      response = {
        query: q,
        results: found ? [found] : [],
        sources: { google: 'ok', openlibrary: 'ok' },
      };
    } else {
      const [google, openLibrary] = await Promise.all([
        this.searchGoogle(q, limit),
        this.searchOpenLibrary(q, limit),
      ]);
      if (google.status !== 'ok' && openLibrary.status === 'error') {
        throw new AppError('SERVICE_UNAVAILABLE', 'The book catalog is unavailable right now.');
      }
      response = {
        query: q,
        results: rankResults(
          mergeResults([google.books, openLibrary.books], 60),
          q,
          openLibrary.popularity,
        ).slice(0, limit),
        sources: { google: google.status, openlibrary: openLibrary.status },
      };
    }

    const partial = response.sources.google !== 'ok' || response.sources.openlibrary !== 'ok';
    await this.options.cache.set(cacheKey, response, partial ? TTL.partialSearch : TTL.search);
    // Seed the details cache so opening a result shows exactly what the reader just saw.
    await Promise.all(response.results.map((book) => this.writeBook(book.catalogId, book)));
    return response;
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
    const hit = cachedBookSchema.safeParse(
      await this.options.cache.get(`book:${CACHE_VERSION}:${catalogId}`),
    );
    if (hit.success) return hit.data.found ? (hit.data.book ?? null) : null;

    const [kind, id = ''] = catalogId.split(':') as [string, string | undefined];
    let book: CatalogBook | null;
    if (kind === 'isbn') book = await this.fetchIsbn(id);
    else if (kind === 'gb') book = await this.fetchGoogleVolume(id);
    else book = await this.fetchOpenLibraryWork(id);
    await this.writeBook(catalogId, book);
    return book;
  }

  /** ISBN-10/13 lookup (barcode scanner). */
  async lookupIsbn(rawIsbn: string): Promise<CatalogBook | null> {
    const isbn13 = toIsbn13(rawIsbn);
    return isbn13 ? this.getBook(`isbn:${isbn13}`) : null;
  }

  private async fetchGoogleVolume(id: string): Promise<CatalogBook | null> {
    if (!(await this.googleAvailable())) {
      throw new AppError('SERVICE_UNAVAILABLE', 'The book catalog is unavailable right now.');
    }
    const result = await this.getJson(
      this.googleUrl(`/volumes/${id}`, { country: 'BR' }),
      'google',
    );
    if (!result.ok) {
      if (result.status === 404 || result.status === 400) return null;
      await this.noteGoogleFailure(result.status);
      throw new AppError('SERVICE_UNAVAILABLE', 'The book catalog is unavailable right now.');
    }
    return mapGoogleVolume(result.data);
  }

  private async fetchIsbn(isbn13: string): Promise<CatalogBook | null> {
    const [google, openLibrary] = await Promise.all([
      this.googleAvailable().then((available) =>
        available
          ? this.getJson(
              this.googleUrl('/volumes', { q: `isbn:${isbn13}`, country: 'BR' }),
              'google',
            )
          : ({ ok: false, status: 429 } as const),
      ),
      this.getJson(`${OPEN_LIBRARY}/isbn/${isbn13}.json`, 'openlibrary'),
    ]);
    if (!google.ok) await this.noteGoogleFailure(google.status);
    // 404 means "not in this library", not "library down".
    const googleDown = !google.ok && google.status !== 404;
    const openLibraryDown = !openLibrary.ok && openLibrary.status !== 404;
    if (googleDown && openLibraryDown) {
      throw new AppError('SERVICE_UNAVAILABLE', 'The book catalog is unavailable right now.');
    }

    let fromGoogle: CatalogBook | null = null;
    if (google.ok) {
      const list = googleListSchema.safeParse(google.data);
      // Google search is fuzzy: only accept a volume that really carries this ISBN.
      fromGoogle =
        (list.success ? (list.data.items ?? []) : [])
          .map(mapGoogleVolume)
          .find((book) => book?.isbn13 === isbn13) ?? null;
    }

    let fromOpenLibrary: CatalogBook | null = null;
    const edition = openLibrary.ok ? openLibraryEditionSchema.safeParse(openLibrary.data) : null;
    const title = edition?.success ? clean(edition.data.title, 300) : null;
    if (edition?.success && title) {
      const data = edition.data;
      const coverId = data.covers?.find((id) => Number.isInteger(id) && id > 0);
      fromOpenLibrary = {
        catalogId: `isbn:${isbn13}`,
        title,
        subtitle: clean(data.subtitle, 300),
        authors: cleanAuthors(await this.authorNames((data.authors ?? []).map((a) => a.key))),
        publisher: clean(data.publishers?.[0], 200),
        publishedYear: parsePublishedYear(data.publish_date),
        totalPages: pages(data.number_of_pages),
        isbn13,
        language: language(data.languages?.[0]?.key.split('/').pop()),
        description: null,
        coverUrls: coverId ? [openLibraryCoverById(coverId)] : [],
        sources: ['openlibrary'],
      };
    }

    const base = fromGoogle ?? fromOpenLibrary;
    if (!base) return null;
    const merged = fromGoogle && fromOpenLibrary ? mergeBooks(fromGoogle, fromOpenLibrary) : base;
    return {
      ...merged,
      catalogId: `isbn:${isbn13}`,
      isbn13,
      coverUrls: orderCovers(coverCandidates({ coverUrl: null, isbn13, extra: merged.coverUrls })),
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

  /** After a 429/403 from Google (shared keyless quota), skip it for a while instead of waiting. */
  private async googleAvailable(): Promise<boolean> {
    return (await this.options.cache.get(GOOGLE_BACKOFF_KEY)) === undefined;
  }

  private async noteGoogleFailure(status: number) {
    if (status === 429 || status === 403) {
      await this.options.cache.set(GOOGLE_BACKOFF_KEY, true, TTL.googleBackoff);
    }
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
      publishedYear: parsePublishedYear(work.data.first_publish_date),
      totalPages: null,
      isbn13: null,
      language: null,
      description: plainDescription(
        typeof description === 'string' ? description : description?.value,
      ),
      coverUrls: coverId ? [openLibraryCoverById(coverId)] : [],
      sources: ['openlibrary'],
    };
  }
}
