import { stableBucket } from './catalog';
import { bookThickness } from './reading';

/** Narrowest and widest spine of the 3D bookcase, in points. */
export const SPINE_WIDTH_MIN = 22;
export const SPINE_WIDTH_MAX = 44;

/**
 * Spine width of a book standing on the 3D bookcase, from its real page count (thin novellas
 * stay thin, long books look heavy; unknown totals use the median thickness).
 */
export function spineWidth(totalPages: number | null | undefined): number {
  return Math.round(
    SPINE_WIDTH_MIN + (SPINE_WIDTH_MAX - SPINE_WIDTH_MIN) * bookThickness(totalPages),
  );
}

/**
 * Relative spine height (0.82–1) picked deterministically from the title, so a shelf looks like a
 * real one (editions differ in height) and the same book always has the same height.
 */
export function spineHeightRatio(title: string): number {
  const steps = 7;
  return Number((0.82 + (0.18 * stableBucket(title, steps)) / (steps - 1)).toFixed(3));
}

export type ShelfItem<T> = { item: T; width: number };

/**
 * Packs items left to right into rows that never exceed `shelfWidth` (an item wider than the shelf
 * gets a row of its own). Order is preserved; rows are never empty.
 */
export function packShelfRows<T>(
  items: readonly ShelfItem<T>[],
  shelfWidth: number,
  gap: number,
): ShelfItem<T>[][] {
  const rows: ShelfItem<T>[][] = [];
  let current: ShelfItem<T>[] = [];
  let used = 0;
  for (const entry of items) {
    const needed = current.length === 0 ? entry.width : used + gap + entry.width;
    if (current.length > 0 && needed > shelfWidth) {
      rows.push(current);
      current = [];
      used = 0;
    }
    current.push(entry);
    used = current.length === 1 ? entry.width : used + gap + entry.width;
  }
  if (current.length > 0) rows.push(current);
  return rows;
}
