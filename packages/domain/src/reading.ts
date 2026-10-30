/** Lifecycle of a book on the reader's shelf. */
export const READING_STATUSES = [
  'want_to_read',
  'reading',
  'paused',
  'finished',
  'abandoned',
] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

export type ReadingProgress = {
  currentPage: number;
  totalPages: number;
  /** 0–100, rounded down so "100%" only appears when the book is really finished. */
  percent: number;
  pagesLeft: number;
};

/** Computes progress defensively (clamps out-of-range pages, handles unknown totals). */
export function readingProgress(currentPage: number, totalPages: number): ReadingProgress {
  const total = Number.isFinite(totalPages) && totalPages > 0 ? Math.floor(totalPages) : 0;
  const current = Math.min(Math.max(0, Math.floor(currentPage || 0)), total);
  const percent = total === 0 ? 0 : Math.floor((current / total) * 100);
  return { currentPage: current, totalPages: total, percent, pagesLeft: total - current };
}

/** Page count below which a book object is drawn as thin as the scale allows. */
export const BOOK_THICKNESS_MIN_PAGES = 80;
/** Page count at which a book object reaches its maximum drawn thickness. */
export const BOOK_THICKNESS_MAX_PAGES = 1_000;

/**
 * Visual thickness of a book object (the 3D cover in the book detail), as a fraction 0–1 of the
 * maximum drawable depth. Derived only from the real page count: thin novellas stay thin, long
 * books look heavy. Unknown or invalid totals use a median thickness instead of inventing one.
 */
export function bookThickness(totalPages: number | null | undefined): number {
  if (totalPages === null || totalPages === undefined) return 0.45;
  if (!Number.isFinite(totalPages) || totalPages <= 0) return 0.45;
  const span = BOOK_THICKNESS_MAX_PAGES - BOOK_THICKNESS_MIN_PAGES;
  const ratio = (totalPages - BOOK_THICKNESS_MIN_PAGES) / span;
  return Math.min(1, Math.max(0.18, Number(ratio.toFixed(3))));
}
