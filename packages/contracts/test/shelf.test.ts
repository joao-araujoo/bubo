import { describe, expect, it } from 'vitest';

import {
  addBookRequestSchema,
  apiPath,
  API_ROUTES,
  catalogSearchQuerySchema,
  createSessionRequestSchema,
  statsResponseSchema,
  updateShelfEntryRequestSchema,
} from '../src';

const session = {
  id: '5b8c1c2e-3f4a-4d6b-9e7f-0a1b2c3d4e5f',
  shelfEntryId: 'entry-1',
  startedAt: '2026-09-26T19:00:00.000Z',
  endedAt: '2026-09-26T19:30:00.000Z',
  focusedSeconds: 25 * 60,
  endPage: 42,
  reflection: '  O absurdo nasce do confronto.  ',
  localDate: '2026-09-26',
};

describe('shelf contracts', () => {
  it('defaults new books to "quero ler"', () => {
    expect(addBookRequestSchema.parse({ title: 'Duna' }).status).toBe('want_to_read');
    for (const status of ['paused', 'abandoned']) {
      expect(addBookRequestSchema.safeParse({ title: 'Duna', status }).success).toBe(false);
    }
  });

  it('accepts already-read books without client-supplied reading history', () => {
    expect(
      addBookRequestSchema.parse({
        title: 'Duna',
        status: 'finished',
        currentPage: 123,
        startedAt: '2020-01-01T00:00:00.000Z',
        finishedAt: '2020-02-01T00:00:00.000Z',
        xpEarned: 500,
      }),
    ).toEqual({ title: 'Duna', status: 'finished' });
    expect(addBookRequestSchema.parse({ catalogId: 'gb:duneGB0001', status: 'finished' })).toEqual({
      catalogId: 'gb:duneGB0001',
      status: 'finished',
    });
  });

  it('accepts a catalog pick and ignores client-sent metadata', () => {
    const parsed = addBookRequestSchema.parse({
      catalogId: 'isbn:9788576573135',
      title: 'Injected title',
      coverUrls: ['https://evil.example/x.jpg'],
      status: 'reading',
    });
    expect(parsed).toEqual({ catalogId: 'isbn:9788576573135', status: 'reading' });
    expect(addBookRequestSchema.safeParse({ catalogId: 'isbn:123' }).success).toBe(false);
  });

  it('validates catalog search queries and bounds the limit', () => {
    expect(catalogSearchQuerySchema.parse({ q: ' duna ' })).toEqual({ q: 'duna', limit: 20 });
    expect(catalogSearchQuerySchema.parse({ q: 'duna', limit: '5' }).limit).toBe(5);
    expect(catalogSearchQuerySchema.safeParse({ q: 'd' }).success).toBe(false);
    expect(catalogSearchQuerySchema.safeParse({ q: 'duna', limit: '500' }).success).toBe(false);
    expect(apiPath(API_ROUTES.catalogBook, { catalogId: 'gb:abc123' })).toBe(
      '/catalog/books/gb%3Aabc123',
    );
  });

  it('requires at least one field to update', () => {
    expect(updateShelfEntryRequestSchema.safeParse({}).success).toBe(false);
    expect(updateShelfEntryRequestSchema.safeParse({ currentPage: 10 }).success).toBe(true);
    expect(updateShelfEntryRequestSchema.safeParse({ currentPage: -1 }).success).toBe(false);
  });

  it('fills route params safely', () => {
    expect(apiPath(API_ROUTES.shelfEntry, { id: 'a/b' })).toBe('/shelf/a%2Fb');
    expect(() => apiPath(API_ROUTES.shelfEntry, {})).toThrow();
  });
});

describe('stats reading recency', () => {
  const olderStats = {
    today: '2026-10-04',
    xpTotal: 0,
    streakDays: 0,
    sessionsCount: 0,
    focusedMinutesThisWeek: 0,
    focusedMinutesToday: 0,
    weekActiveDates: [],
    weekReadingDates: [],
    readToday: false,
    reviewedToday: false,
    dueCards: 0,
  };

  it('defaults missing recency to null for older APIs and cached responses', () => {
    expect(statsResponseSchema.parse(olderStats).lastReadingDate).toBeNull();
    expect(
      statsResponseSchema.parse({ ...olderStats, lastReadingDate: null }).lastReadingDate,
    ).toBeNull();
  });

  it('accepts a recorded calendar date and rejects impossible dates', () => {
    expect(
      statsResponseSchema.parse({ ...olderStats, lastReadingDate: '2024-02-29' }).lastReadingDate,
    ).toBe('2024-02-29');
    for (const invalid of ['2026-02-29', '2026-13-01', '2026-10-04T00:00:00Z']) {
      expect(
        statsResponseSchema.safeParse({ ...olderStats, lastReadingDate: invalid }).success,
      ).toBe(false);
    }
  });
});

describe('createSessionRequestSchema', () => {
  it('accepts a real session and trims the reflection', () => {
    expect(createSessionRequestSchema.parse(session).reflection).toBe(
      'O absurdo nasce do confronto.',
    );
  });

  it('rejects impossible timings and invalid dates', () => {
    expect(createSessionRequestSchema.safeParse({ ...session, focusedSeconds: 30 }).success).toBe(
      false,
    );
    expect(
      createSessionRequestSchema.safeParse({ ...session, focusedSeconds: 3 * 3600 }).success,
    ).toBe(false);
    expect(
      createSessionRequestSchema.safeParse({ ...session, endedAt: '2026-09-26T18:00:00.000Z' })
        .success,
    ).toBe(false);
    expect(
      createSessionRequestSchema.safeParse({ ...session, localDate: '2026-02-30' }).success,
    ).toBe(false);
    expect(
      createSessionRequestSchema.safeParse({ ...session, reflection: 'x'.repeat(2001) }).success,
    ).toBe(false);
  });
});
