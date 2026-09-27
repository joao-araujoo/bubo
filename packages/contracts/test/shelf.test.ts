import { describe, expect, it } from 'vitest';

import {
  addBookRequestSchema,
  apiPath,
  API_ROUTES,
  catalogSearchQuerySchema,
  createSessionRequestSchema,
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
    expect(addBookRequestSchema.safeParse({ title: 'Duna', status: 'finished' }).success).toBe(
      false,
    );
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
