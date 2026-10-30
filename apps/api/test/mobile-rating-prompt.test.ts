import { describe, expect, it, vi } from 'vitest';
import { type ShelfEntry } from '@bubo/contracts';

import { createRatingPrompt } from '../../mobile/src/lib/rating-prompt';

const entry = (patch: Partial<ShelfEntry> = {}): ShelfEntry => ({
  id: 'entry-1',
  status: 'finished',
  currentPage: 200,
  startedAt: null,
  finishedAt: '2026-10-04T12:00:00.000Z',
  rating: null,
  favorite: false,
  owned: false,
  wishlist: false,
  rereading: false,
  addedAt: null,
  book: {
    id: 'book-1',
    title: 'Torto Arado',
    author: 'Itamar Vieira Junior',
    totalPages: 200,
    catalogId: null,
    isbn13: null,
    publisher: null,
    publishedYear: null,
    coverUrls: [],
  },
  ...patch,
});

describe('rating prompt', () => {
  it('asks once for a finished, unrated book', () => {
    const prompt = createRatingPrompt();
    const listener = vi.fn();
    prompt.subscribe(listener);
    prompt.offer(entry());
    prompt.offer(entry());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('never asks for unfinished or already rated books', () => {
    const prompt = createRatingPrompt();
    const listener = vi.fn();
    prompt.subscribe(listener);
    prompt.offer(entry({ status: 'reading' }));
    prompt.offer(entry({ id: 'entry-2', rating: 4 }));
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the offer for later when no popup is mounted', () => {
    const prompt = createRatingPrompt();
    prompt.offer(entry());
    const listener = vi.fn();
    const unsubscribe = prompt.subscribe(listener);
    prompt.offer(entry());
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    prompt.offer(entry({ id: 'entry-3' }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
