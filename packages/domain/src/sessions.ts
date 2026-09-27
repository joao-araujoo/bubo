import { type ReadingStatus } from './reading';

/** A focused reading session is at most 4 hours (longer means the timer was left running). */
export const MAX_SESSION_SECONDS = 4 * 60 * 60;
export const MIN_SESSION_SECONDS = 60;
export const MAX_REFLECTION_LENGTH = 2000;

export type ShelfState = {
  status: ReadingStatus;
  currentPage: number;
  totalPages: number | null;
  startedAt: Date | null;
  finishedAt: Date | null;
};

/**
 * Shelf state after a reading session that ended on `endPage`:
 * progress never goes backwards, reading starts (if needed) and the book is finished when the
 * last page is reached.
 */
export function applySessionToShelf(state: ShelfState, endPage: number, now: Date): ShelfState {
  const clampedEnd = state.totalPages ? Math.min(endPage, state.totalPages) : endPage;
  const currentPage = Math.max(state.currentPage, clampedEnd);
  const finished = state.totalPages !== null && currentPage >= state.totalPages;
  return {
    ...state,
    currentPage,
    status: finished ? 'finished' : 'reading',
    startedAt: state.startedAt ?? now,
    finishedAt: finished ? (state.finishedAt ?? now) : null,
  };
}

/** Timestamps implied by a manual status change (keeps the first start / finish time). */
export function applyStatusChange(state: ShelfState, status: ReadingStatus, now: Date): ShelfState {
  const startsReading = status === 'reading' || status === 'paused' || status === 'finished';
  return {
    ...state,
    status,
    startedAt: startsReading ? (state.startedAt ?? now) : state.startedAt,
    finishedAt: status === 'finished' ? (state.finishedAt ?? now) : null,
    currentPage:
      status === 'finished' && state.totalPages !== null ? state.totalPages : state.currentPage,
  };
}
