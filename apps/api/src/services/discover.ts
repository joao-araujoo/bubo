import {
  type CatalogBook,
  catalogBookSchema,
  type CatalogDiscoverResponse,
  catalogDiscoverResponseSchema,
  type DiscoverItem,
  type DiscoverSection,
  discoverSectionSchema,
} from '@bubo/contracts';
import { type Database, schema } from '@bubo/database';
import {
  foldText,
  GENRE_SUBJECTS,
  type Genre,
  INTEREST_SEED_WEIGHT,
  isCatalogId,
  MAX_BOOK_PAGES,
  type Recommendation,
  recommendBooks,
  type RecommendSeed,
  type ReadingStatus,
  READING_STATUSES,
  SEED_STATUS_WEIGHT,
  sharedGenreLabel,
  topSeedSubjects,
  workMatchKey,
} from '@bubo/domain';
import { and, desc, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import { type CatalogService, type OpenLibraryWork } from './catalog';
import { type CatalogCache } from './catalog-cache';
import { bookCoverUrls } from './shelf';

/**
 * Discover (ADR-031): Skoob-style shelves built only from real signals. "Para você" and
 * "Porque você leu X" come from the taste graph in `@bubo/domain/recommend` over Open Library works
 * that have a Portuguese edition; "Mais lidos no Bubo" counts distinct Bubo readers (≥ 2, never
 * names); "Mais lidos em português" is Open Library's reading-log ranking.
 */

const { books, shelfEntries, readerProfiles } = schema;
const CACHE_VERSION = 'v2';
const TTL = { ok: 6 * 60 * 60, partial: 10 * 60 } as const;
const MAX_SEEDS = 8;
const COMMUNITY_MIN_READERS = 2;

export const GENRE_LABELS: Record<Genre, string> = {
  science_fiction: 'Ficção científica',
  philosophy: 'Filosofia',
  fantasy: 'Fantasia',
  psychology: 'Psicologia',
  history: 'História',
  business: 'Negócios',
  technology: 'Tecnologia',
  biography: 'Biografias',
  science: 'Ciência',
  mystery: 'Mistério',
  self_care: 'Autocuidado',
};

type ShelfRow = {
  entryId: string;
  status: ReadingStatus;
  title: string;
  authors: string[];
  isbn: string | null;
  catalogKey: string | null;
};

type ReaderTaste = { shelf: ShelfRow[]; interests: Genre[] };

/** "Machado de Assis, Outro" / "A & B" → names. */
export function splitAuthors(value: string | null): string[] {
  return (value ?? '')
    .split(/\s*[,;&]\s*|\s+e\s+|\s+and\s+/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 4);
}

async function loadTaste(db: Database, userId: string): Promise<ReaderTaste> {
  const [rows, [profile]] = await Promise.all([
    db
      .select({
        entryId: shelfEntries.id,
        status: shelfEntries.status,
        title: books.title,
        author: books.author,
        isbn: books.isbn,
        catalogKey: books.catalogKey,
      })
      .from(shelfEntries)
      .innerJoin(books, eq(books.id, shelfEntries.bookId))
      .where(eq(shelfEntries.userId, userId))
      .orderBy(desc(shelfEntries.updatedAt), desc(shelfEntries.createdAt))
      .limit(300),
    db
      .select({ interests: readerProfiles.interests })
      .from(readerProfiles)
      .where(eq(readerProfiles.userId, userId))
      .limit(1),
  ]);
  return {
    shelf: rows.map((row) => ({
      entryId: row.entryId,
      status: (READING_STATUSES as readonly string[]).includes(row.status)
        ? (row.status as ReadingStatus)
        : 'want_to_read',
      title: row.title,
      authors: splitAuthors(row.author),
      isbn: row.isbn,
      catalogKey: row.catalogKey,
    })),
    interests: (profile?.interests ?? []).filter((genre): genre is Genre =>
      Object.hasOwn(GENRE_SUBJECTS, genre),
    ),
  };
}

/** Shelf books that best describe the reader: finished and current reads first. */
function pickSeeds(shelf: readonly ShelfRow[]): ShelfRow[] {
  return shelf
    .map((row, index) => ({ row, index, weight: SEED_STATUS_WEIGHT[row.status] }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, MAX_SEEDS)
    .map((entry) => entry.row);
}

/** Folded, quote-free text: the only user-derived input that reaches Solr syntax. */
const solrText = (value: string) => foldText(value).slice(0, 80);
const mainTitle = (title: string) => solrText(title.split(/[:(–—]/)[0] ?? title);

function seedQuery(seed: ShelfRow): string | null {
  if (seed.isbn && /^97[89]\d{10}$/.test(seed.isbn)) return `isbn:${seed.isbn}`;
  const title = mainTitle(seed.title);
  if (!title) return null;
  const lastName = solrText(seed.authors[0] ?? '')
    .split(' ')
    .pop();
  return lastName ? `(title:"${title}" AND author:"${lastName}")` : `title:"${title}"`;
}

function sameWork(seed: ShelfRow, work: OpenLibraryWork): boolean {
  if (seed.isbn && work.editionIsbns.includes(seed.isbn)) return true;
  const key = workMatchKey(seed.title, seed.authors);
  const titleOnly = !seed.authors.length;
  return work.titles.some((title) => {
    const other = workMatchKey(title, work.book.authors);
    return titleOnly ? other.split('|')[0] === key.split('|')[0] : other === key;
  });
}

/** Keys that identify anything already on the shelf (any edition or language of a work). */
function shelfMatcher(shelf: readonly ShelfRow[], resolved: readonly OpenLibraryWork[]) {
  const workKeys = new Set(resolved.map((work) => work.workKey));
  const titleKeys = new Set(shelf.map((row) => workMatchKey(row.title, row.authors)));
  const isbns = new Set(shelf.map((row) => row.isbn).filter(Boolean));
  const catalogIds = new Set(shelf.map((row) => row.catalogKey).filter(Boolean));
  return (work: OpenLibraryWork) =>
    workKeys.has(work.workKey) ||
    catalogIds.has(work.book.catalogId) ||
    work.editionIsbns.some((isbn) => isbns.has(isbn)) ||
    work.titles.some((title) => titleKeys.has(workMatchKey(title, work.book.authors)));
}

const shorten = (title: string) => (title.length > 48 ? `${title.slice(0, 47).trimEnd()}…` : title);

/** The Portuguese "why" for a recommendation, built only from the graph evidence behind it. */
export function reasonText(
  recommendation: Recommendation,
  seeds: ReadonlyMap<string, RecommendSeed>,
  candidateSubjects: readonly string[] = [],
): string | null {
  const reason = recommendation.reason;
  const seed = seeds.get(reason.seedId);
  if (!seed) return null;
  if (!seed.title) {
    const genre = reason.seedId.slice('genre:'.length) as Genre;
    return `Porque você curte ${(GENRE_LABELS[genre] ?? 'esse gênero').toLowerCase()}`;
  }
  const title = shorten(seed.title);
  if (reason.kind === 'author') return `Mesma autoria de ${title}`;
  if (reason.kind === 'subject') {
    const label = sharedGenreLabel(seed.subjects, candidateSubjects);
    return label ? `${label}, como ${title}` : `Parecido com ${title}`;
  }
  return `Para quem gostou de ${title}`;
}

function sectionTitleFor(seed: ShelfRow): string {
  const title = shorten(seed.title);
  if (seed.status === 'finished') return `Porque você leu ${title}`;
  if (seed.status === 'reading' || seed.status === 'paused') {
    return `Porque você está lendo ${title}`;
  }
  return `Parecidos com ${title}`;
}

const item = (book: CatalogBook, reason: string | null, readers: number | null = null) => ({
  book,
  reason,
  readers,
});

/** Shelves read as covers: drop coverless books whenever at least six covered ones remain. */
export function preferCovered(items: readonly DiscoverItem[], minimum = 6): DiscoverItem[] {
  const covered = items.filter((entry) => entry.book.coverUrls.length > 0);
  return covered.length >= minimum ? covered : [...items];
}

function capPerAuthor(works: readonly OpenLibraryWork[], max: number): OpenLibraryWork[] {
  const counts = new Map<string, number>();
  return works.filter((work) => {
    const author = foldText(work.book.authors[0] ?? work.workKey);
    const count = counts.get(author) ?? 0;
    counts.set(author, count + 1);
    return count < max;
  });
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Open Library-derived sections (cached); the Bubo community section is always read fresh. */
const externalSectionsSchema = catalogDiscoverResponseSchema.omit({ sections: true }).extend({
  before: z.array(discoverSectionSchema),
  after: z.array(discoverSectionSchema),
});
type ExternalSections = z.infer<typeof externalSectionsSchema>;

export class DiscoverService {
  constructor(
    private readonly deps: { db: Database; catalog: CatalogService; cache: CatalogCache },
  ) {}

  async discover(userId: string, genre?: Genre): Promise<CatalogDiscoverResponse> {
    const taste = await loadTaste(this.deps.db, userId);
    const seeds = pickSeeds(taste.shelf);
    const signature = await sha256(
      JSON.stringify([
        genre ?? null,
        taste.interests,
        seeds.map((seed) => [seed.title, seed.authors, seed.isbn, seed.status]),
        // Every shelf book is excluded from results, not just the seeds.
        taste.shelf.map((row) => row.catalogKey ?? row.title),
      ]),
    );
    const key = `discover:${CACHE_VERSION}:${signature}`;
    const hit = externalSectionsSchema.safeParse(await this.deps.cache.get(key));
    let external: ExternalSections;
    if (hit.success) external = hit.data;
    else {
      external = await this.build(taste, seeds, genre);
      await this.deps.cache.set(
        key,
        external,
        external.sources.openlibrary === 'ok' ? TTL.ok : TTL.partial,
      );
    }
    const community = genre ? null : await this.community(userId, taste);
    const sections = [...external.before, ...(community ? [community] : []), ...external.after].map(
      (section) => ({ ...section, items: preferCovered(section.items) }),
    );
    // Cover-cache metadata is per deployment, so it is read fresh rather than cached.
    const withCovers = await Promise.all(
      sections.map(async (section) => {
        const covered = await this.deps.catalog.withCachedCovers(
          section.items.map((entry) => entry.book),
        );
        return {
          ...section,
          items: section.items.map((entry, index) => ({
            ...entry,
            book: covered[index] ?? entry.book,
          })),
        };
      }),
    );
    return { sections: withCovers, basedOn: external.basedOn, sources: external.sources };
  }

  private async build(
    taste: ReaderTaste,
    shelfSeeds: ShelfRow[],
    genre: Genre | undefined,
  ): Promise<ExternalSections> {
    const { catalog } = this.deps;
    let failed = false;

    // 1. One Open Library query resolves every seed to its work (subjects, canonical authors).
    const parts = shelfSeeds.map(seedQuery).filter((part): part is string => part !== null);
    const resolvedSearch = parts.length
      ? await catalog.openLibraryWorks({ q: parts.join(' OR '), limit: 40 })
      : { status: 'ok' as const, works: [] };
    if (resolvedSearch.status === 'error') failed = true;
    const resolved: OpenLibraryWork[] = [];
    // Author query terms: exact Open Library ids when the seed resolved, else the surname.
    const authorTerms = new Map<string, number>();
    const weighAuthor = (term: string, weight: number) =>
      authorTerms.set(term, (authorTerms.get(term) ?? 0) + weight);
    const seeds: RecommendSeed[] = shelfSeeds.map((row) => {
      const work = resolvedSearch.works.find((candidate) => sameWork(row, candidate));
      const weight = SEED_STATUS_WEIGHT[row.status];
      if (work) {
        resolved.push(work);
        for (const key of work.authorKeys.slice(0, 2)) weighAuthor(`author_key:${key}`, weight);
      } else {
        const surname = solrText(row.authors[0] ?? '')
          .split(' ')
          .pop();
        if (surname) weighAuthor(`author:"${surname}"`, weight);
      }
      return {
        id: row.entryId,
        title: row.title,
        authors: work?.book.authors.length ? work.book.authors : row.authors,
        subjects: work?.subjects ?? [],
        weight,
      };
    });
    for (const interest of taste.interests) {
      seeds.push({
        id: `genre:${interest}`,
        title: null,
        authors: [],
        subjects: [GENRE_SUBJECTS[interest]],
        weight: INTEREST_SEED_WEIGHT,
      });
    }
    const seedsById = new Map(seeds.map((seed) => [seed.id, seed]));
    const onShelf = shelfMatcher(taste.shelf, resolved);
    const basedOn = { books: shelfSeeds.length, interests: taste.interests.length };

    if (genre) {
      const subject = GENRE_SUBJECTS[genre];
      const result = await catalog.openLibraryWorks({
        q: `subject:"${subject}" AND language:por`,
        limit: 80,
        sort: 'readinglog',
      });
      if (result.status === 'error') failed = true;
      const works = capPerAuthor(
        result.works.filter((work) => !onShelf(work)),
        3,
      );
      const ranked = recommendBooks(seeds, works.map(toCandidate), {
        limit: works.length,
        perAuthor: 3,
      });
      const byId = new Map(ranked.map((entry) => [entry.id, entry]));
      const total = Math.max(1, works.length);
      // Popularity order nudged by the reader's taste (half popularity rank, half affinity).
      const ordered = works
        .map((work, index) => {
          const recommendation = byId.get(work.workKey);
          return {
            work,
            recommendation,
            score: 0.5 * (1 - index / total) + 0.5 * (recommendation?.affinity ?? 0),
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 24);
      return {
        before: [
          {
            id: `genre:${genre}`,
            kind: 'genre',
            title: `Mais lidos em ${GENRE_LABELS[genre].toLowerCase()}`,
            subtitle: 'Edições em português, dos mais marcados aos menos',
            items: ordered.map(({ work, recommendation }) =>
              item(
                work.book,
                recommendation && recommendation.affinity >= 0.3
                  ? reasonText(recommendation, seedsById, work.subjects)
                  : null,
              ),
            ),
          },
        ],
        after: [],
        basedOn,
        sources: { openlibrary: failed ? 'error' : 'ok' },
      };
    }

    // 2. Candidates: works with a Portuguese edition by the reader's authors and subjects.
    const subjects = topSeedSubjects(seeds, 5);
    const authors = [...authorTerms.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
      .map(([term]) => term);
    const [bySubject, byAuthor, popular] = await Promise.all([
      subjects.length
        ? catalog.openLibraryWorks({
            q: `(${subjects.map((subject) => `subject:"${subject}"`).join(' OR ')}) AND language:por`,
            limit: 80,
            sort: 'readinglog',
          })
        : { status: 'ok' as const, works: [] },
      authors.length
        ? catalog.openLibraryWorks({
            q: `(${authors.join(' OR ')}) AND language:por`,
            limit: 40,
            sort: 'readinglog',
          })
        : { status: 'ok' as const, works: [] },
      catalog.openLibraryWorks({ q: 'language:por', limit: 60, sort: 'readinglog' }),
    ]);
    if ([bySubject, byAuthor, popular].some((result) => result.status === 'error')) failed = true;

    const pool = new Map<string, OpenLibraryWork>();
    for (const work of [...byAuthor.works, ...bySubject.works]) {
      if (!onShelf(work) && !pool.has(work.workKey)) pool.set(work.workKey, work);
    }
    const ranked = recommendBooks(seeds, [...pool.values()].map(toCandidate), {
      limit: 40,
      perAuthor: 2,
    });

    const before: DiscoverSection[] = [];
    const forYou = ranked.slice(0, 12);
    if (forYou.length) {
      before.push({
        id: 'for_you',
        kind: 'for_you',
        title: 'Para você',
        subtitle: shelfSeeds.length ? 'Com base na sua estante' : 'Com base nos seus gêneros',
        items: forYou.flatMap((entry) => {
          const work = pool.get(entry.id);
          return work ? [item(work.book, reasonText(entry, seedsById, work.subjects))] : [];
        }),
      });
    }
    const shown = new Set(forYou.map((entry) => entry.id));
    for (const seed of shelfSeeds.slice(0, 3)) {
      const related = ranked
        .filter((entry) => entry.reason.seedId === seed.entryId && !shown.has(entry.id))
        .slice(0, 10);
      if (related.length < 3) continue;
      for (const entry of related) shown.add(entry.id);
      before.push({
        id: `because:${seed.entryId}`,
        kind: 'because',
        title: sectionTitleFor(seed),
        subtitle: null,
        items: related.flatMap((entry) => {
          const work = pool.get(entry.id);
          return work ? [item(work.book, reasonText(entry, seedsById, work.subjects))] : [];
        }),
      });
    }

    const popularWorks = capPerAuthor(
      popular.works.filter((work) => !onShelf(work)),
      2,
    ).slice(0, 15);
    const after: DiscoverSection[] = popularWorks.length
      ? [
          {
            id: 'popular',
            kind: 'popular',
            title: 'Mais lidos em português',
            subtitle: 'Os mais marcados por leitores no Open Library',
            items: popularWorks.map((work) => item(work.book, null)),
          },
        ]
      : [];
    return { before, after, basedOn, sources: { openlibrary: failed ? 'error' : 'ok' } };
  }

  /** Catalog books other Bubo readers are reading or finished (≥ 2 distinct readers). */
  private async community(userId: string, taste: ReaderTaste): Promise<DiscoverSection | null> {
    const readers = sql<number>`count(distinct ${shelfEntries.userId})::int`;
    const rows = await this.deps.db
      .select({ book: books, readers })
      .from(shelfEntries)
      .innerJoin(books, eq(books.id, shelfEntries.bookId))
      .where(
        and(
          inArray(shelfEntries.status, ['reading', 'finished']),
          isNotNull(books.catalogKey),
          ne(shelfEntries.userId, userId),
        ),
      )
      .groupBy(books.id)
      .having(sql`count(distinct ${shelfEntries.userId}) >= ${COMMUNITY_MIN_READERS}`)
      .orderBy(desc(readers), books.title)
      .limit(30);
    const own = new Set(taste.shelf.map((row) => row.catalogKey).filter(Boolean));
    const items: DiscoverItem[] = [];
    for (const row of rows) {
      const catalogId = row.book.catalogKey;
      if (!catalogId || own.has(catalogId) || !isCatalogId(catalogId)) continue;
      const pages = row.book.totalPages;
      const parsed = catalogBookSchema.safeParse({
        catalogId,
        title: row.book.title,
        subtitle: null,
        authors: splitAuthors(row.book.author),
        publisher: row.book.publisher,
        publishedYear: row.book.publishedYear,
        totalPages: pages && pages >= 1 && pages <= MAX_BOOK_PAGES ? pages : null,
        isbn13: row.book.isbn,
        language: row.book.language,
        description: null,
        coverUrls: bookCoverUrls(row.book),
        sources: [],
        edition: catalogId.endsWith('W') ? 'work' : 'edition',
      });
      if (parsed.success) items.push(item(parsed.data, null, row.readers));
      if (items.length >= 15) break;
    }
    return items.length
      ? {
          id: 'community',
          kind: 'community',
          title: 'Mais lidos no Bubo',
          subtitle: 'O que outros leitores do Bubo estão lendo ou já terminaram',
          items,
        }
      : null;
  }
}

function toCandidate(work: OpenLibraryWork) {
  return {
    id: work.workKey,
    authors: work.book.authors,
    subjects: work.subjects,
    readers: work.readers,
    rating: work.rating,
  };
}
