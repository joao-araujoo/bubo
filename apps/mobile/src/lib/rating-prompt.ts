import { type ShelfEntry } from '@bubo/contracts';

type Listener = (entry: ShelfEntry) => void;

export const RATING_LABELS: Record<number, string> = {
  1: 'Não curti',
  2: 'Mais ou menos',
  3: 'Bom',
  4: 'Muito bom',
  5: 'Amei!',
};

/**
 * Bridges accepted shelf mutations (status, additions, sessions) to the single rating popup
 * mounted at the root. Plain module state: no React, so mutation hooks can call it directly.
 */
export function createRatingPrompt() {
  let listener: Listener | null = null;
  const offered = new Set<string>();
  return {
    subscribe(next: Listener) {
      listener = next;
      return () => {
        if (listener === next) listener = null;
      };
    },
    /** Asks once per book per app run, only for a finished book the reader hasn't rated. */
    offer(entry: ShelfEntry) {
      if (entry.status !== 'finished' || entry.rating !== null || offered.has(entry.id)) return;
      if (!listener) return;
      offered.add(entry.id);
      listener(entry);
    },
  };
}

export const ratingPrompt = createRatingPrompt();
