import { describe, expect, it } from 'vitest';

import {
  type LibraryEntry,
  alsoReadPercent,
  finishForecast,
  finishedInYear,
  inLibraryShelf,
  keepsRereading,
  libraryCounts,
  pagesThrough,
  ratingSummary,
} from '../src/library';

const entry = (overrides: Partial<LibraryEntry> = {}): LibraryEntry => ({
  status: 'want_to_read',
  currentPage: 0,
  finishedAt: null,
  favorite: false,
  owned: false,
  wishlist: false,
  book: { totalPages: 200 },
  ...overrides,
});

describe('Estante shelves', () => {
  it('counts statuses and the reader marks independently', () => {
    const entries = [
      entry({ status: 'reading', owned: true }),
      entry({ status: 'finished', favorite: true, owned: true }),
      entry({ wishlist: true }),
      entry({ status: 'abandoned' }),
    ];
    expect(libraryCounts(entries)).toEqual({
      reading: 1,
      want_to_read: 1,
      finished: 1,
      favorite: 1,
      owned: 2,
      wishlist: 1,
      paused: 0,
      abandoned: 1,
    });
    expect(inLibraryShelf(entries[1] as LibraryEntry, 'favorite')).toBe(true);
    expect(inLibraryShelf(entries[1] as LibraryEntry, 'reading')).toBe(false);
  });

  it('counts pages the reader went through', () => {
    expect(pagesThrough(entry({ status: 'finished', currentPage: 10 }))).toBe(200);
    expect(pagesThrough(entry({ status: 'reading', currentPage: 140 }))).toBe(140);
    expect(
      pagesThrough(entry({ status: 'finished', book: { totalPages: null }, currentPage: 90 })),
    ).toBe(90);
  });

  it('collects the books declared finished in a year', () => {
    const result = finishedInYear(
      [
        entry({ status: 'finished', finishedAt: '2026-03-02T10:00:00.000Z' }),
        entry({ status: 'finished', finishedAt: '2025-12-30T10:00:00.000Z' }),
        entry({ status: 'reading', finishedAt: null }),
      ],
      2026,
    );
    expect(result.books).toHaveLength(1);
    expect(result.pages).toBe(200);
  });

  it('keeps "Relendo" only while reading or paused', () => {
    expect(keepsRereading('reading')).toBe(true);
    expect(keepsRereading('paused')).toBe(true);
    expect(keepsRereading('finished')).toBe(false);
    expect(keepsRereading('want_to_read')).toBe(false);
  });
});

describe('finish forecast', () => {
  const sessions = [
    { localDate: '2026-10-22', pagesRead: 30 },
    { localDate: '2026-10-25', pagesRead: 40 },
    { localDate: '2026-10-29', pagesRead: 42 },
  ];

  it('uses the pace since the first recent session', () => {
    // 112 pages over 8 calendar days = 14/day; 124 pages left → 9 days.
    expect(finishForecast({ sessions, today: '2026-10-29', pagesLeft: 124 })).toEqual({
      pagesPerDay: 14,
      days: 9,
      date: '2026-11-07',
    });
  });

  it('ignores sessions older than two weeks', () => {
    const old = [{ localDate: '2026-09-01', pagesRead: 300 }, ...sessions.slice(2)];
    expect(finishForecast({ sessions: old, today: '2026-10-29', pagesLeft: 50 })).toBeNull();
  });

  it('needs pages left, two sessions and progress', () => {
    expect(finishForecast({ sessions, today: '2026-10-29', pagesLeft: 0 })).toBeNull();
    expect(
      finishForecast({
        sessions: [
          { localDate: '2026-10-28', pagesRead: 0 },
          { localDate: '2026-10-29', pagesRead: 0 },
        ],
        today: '2026-10-29',
        pagesLeft: 10,
      }),
    ).toBeNull();
  });
});

describe('anonymous community numbers', () => {
  it('summarises ratings only from five ratings on', () => {
    expect(ratingSummary([0, 0, 0, 1, 3])).toBeNull();
    expect(ratingSummary([0, 0, 1, 1, 3])).toEqual({
      count: 5,
      average: 4.4,
      distribution: [
        { stars: 5, percent: 60 },
        { stars: 4, percent: 20 },
        { stars: 3, percent: 20 },
        { stars: 2, percent: 0 },
        { stars: 1, percent: 0 },
      ],
    });
  });

  it('shows "também leram" only above both floors', () => {
    expect(alsoReadPercent(2, 3)).toBe(67);
    expect(alsoReadPercent(1, 10)).toBeNull();
    expect(alsoReadPercent(2, 2)).toBeNull();
    expect(alsoReadPercent(5, 4)).toBeNull();
  });
});
