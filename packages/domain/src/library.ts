import { type ReadingStatus } from './reading';
import { addDays } from './streak';

/**
 * Pure rules behind the redesigned Estante and book page (ADR-046): the reader's shelves and
 * collections, the finish forecast from real sessions and the privacy floors of the anonymous
 * community numbers. Nothing here invents a reader, a rating or a date.
 */

/** Books up to this many pages count as "curtinhos" in the Quero ler collection. */
export const SHORT_BOOK_PAGES = 150;

/** Shelves of the Estante: the statuses plus the reader's own marks. */
export const LIBRARY_SHELVES = [
  'reading',
  'want_to_read',
  'finished',
  'favorite',
  'owned',
  'wishlist',
  'paused',
  'abandoned',
] as const;
export type LibraryShelf = (typeof LIBRARY_SHELVES)[number];

export type LibraryEntry = {
  status: ReadingStatus;
  currentPage: number;
  finishedAt: string | null;
  favorite: boolean;
  owned: boolean;
  wishlist: boolean;
  book: { totalPages: number | null };
};

export function inLibraryShelf(entry: LibraryEntry, shelf: LibraryShelf): boolean {
  switch (shelf) {
    case 'favorite':
      return entry.favorite;
    case 'owned':
      return entry.owned;
    case 'wishlist':
      return entry.wishlist;
    default:
      return entry.status === shelf;
  }
}

export function libraryCounts(entries: readonly LibraryEntry[]): Record<LibraryShelf, number> {
  const counts = Object.fromEntries(LIBRARY_SHELVES.map((shelf) => [shelf, 0])) as Record<
    LibraryShelf,
    number
  >;
  for (const entry of entries) {
    for (const shelf of LIBRARY_SHELVES) if (inLibraryShelf(entry, shelf)) counts[shelf] += 1;
  }
  return counts;
}

/** Pages the reader went through: a finished book counts whole, others up to the current page. */
export function pagesThrough(entry: LibraryEntry): number {
  if (entry.status === 'finished' && entry.book.totalPages !== null) return entry.book.totalPages;
  return Math.max(0, entry.currentPage);
}

/** Books declared finished in `year` (by `finishedAt`) and their pages. */
export function finishedInYear<T extends LibraryEntry>(entries: readonly T[], year: number) {
  const books = entries.filter(
    (entry) => entry.status === 'finished' && entry.finishedAt?.startsWith(`${year}-`),
  );
  return { books, pages: books.reduce((sum, entry) => sum + pagesThrough(entry), 0) };
}

/** "Relendo" only lasts while the book is being read (or paused); finishing or leaving ends it. */
export function keepsRereading(status: ReadingStatus): boolean {
  return status === 'reading' || status === 'paused';
}

/** Recent days of sessions that set the reading pace of the forecast. */
export const FORECAST_WINDOW_DAYS = 14;

export type FinishForecast = {
  /** Pages per calendar day since the first session in the window (rounded, at least 1). */
  pagesPerDay: number;
  days: number;
  date: string;
};

/**
 * When the book would end at the reader's recent pace: pages of this book's sessions in the last
 * 14 days over the calendar days since the first of them. Needs two sessions and progress.
 */
export function finishForecast(input: {
  sessions: readonly { localDate: string; pagesRead: number }[];
  today: string;
  pagesLeft: number;
}): FinishForecast | null {
  if (input.pagesLeft <= 0) return null;
  const start = addDays(input.today, -(FORECAST_WINDOW_DAYS - 1));
  const recent = input.sessions.filter(
    (session) => session.localDate >= start && session.localDate <= input.today,
  );
  if (recent.length < 2) return null;
  const pages = recent.reduce((sum, session) => sum + Math.max(0, session.pagesRead), 0);
  if (pages <= 0) return null;
  const first = recent.reduce(
    (earliest, session) => (session.localDate < earliest ? session.localDate : earliest),
    input.today,
  );
  const span = Math.round((Date.parse(input.today) - Date.parse(first)) / 86_400_000) + 1;
  const rate = pages / span;
  const days = Math.max(1, Math.ceil(input.pagesLeft / rate));
  return {
    pagesPerDay: Math.max(1, Math.round(rate)),
    days,
    date: addDays(input.today, days),
  };
}

/**
 * Privacy floors for the anonymous numbers of a book (ADR-046). Below them nothing is shown, so
 * a single friend's rating or shelf can never be singled out.
 */
export const COMMUNITY_MIN_READERS = 2;
export const COMMUNITY_MIN_RATINGS = 5;
export const ALSO_READ_MIN_BASE = 3;
export const ALSO_READ_MIN_SHARED = 2;

export type RatingSummary = {
  count: number;
  /** One decimal, e.g. 4.7. */
  average: number;
  /** 5★ first; whole percents of `count`. */
  distribution: { stars: 1 | 2 | 3 | 4 | 5; percent: number }[];
};

/** `counts[0]` is the number of 1★ ratings … `counts[4]` of 5★. Null under the floor. */
export function ratingSummary(counts: readonly number[]): RatingSummary | null {
  const safe = [0, 1, 2, 3, 4].map((index) => Math.max(0, Math.floor(counts[index] ?? 0)));
  const count = safe.reduce((sum, value) => sum + value, 0);
  if (count < COMMUNITY_MIN_RATINGS) return null;
  const total = safe.reduce((sum, value, index) => sum + value * (index + 1), 0);
  return {
    count,
    average: Math.round((total / count) * 10) / 10,
    distribution: ([5, 4, 3, 2, 1] as const).map((stars) => ({
      stars,
      percent: Math.round(((safe[stars - 1] ?? 0) / count) * 100),
    })),
  };
}

/** Share of this book's readers who also shelved another book, or null under the floors. */
export function alsoReadPercent(shared: number, base: number): number | null {
  if (base < ALSO_READ_MIN_BASE || shared < ALSO_READ_MIN_SHARED || shared > base) return null;
  return Math.round((shared / base) * 100);
}
