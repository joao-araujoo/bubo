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
