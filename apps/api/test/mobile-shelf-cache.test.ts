import {
  type CatalogBookResponse,
  type ShelfEntry,
  type ShelfEntryDetail,
  type ShelfResponse,
  catalogBookResponseSchema,
  shelfEntryDetailSchema,
  shelfEntrySchema,
} from '@bubo/contracts';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { cacheAcceptedShelfEntry } from '../../mobile/src/lib/api/shelf-cache';

const USER = 'reader-a';
const OTHER_USER = 'reader-b';
const ISBN = '9788576573135';
const clients: QueryClient[] = [];

function createClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return client;
}

afterEach(() => {
  for (const client of clients) client.clear();
  clients.length = 0;
});

function entry(id: string): ShelfEntry {
  return shelfEntrySchema.parse({
    id,
    status: 'reading',
    currentPage: 40,
    startedAt: '2026-10-01T12:00:00.000Z',
    finishedAt: null,
    book: {
      id: `book-${id}`,
      title: 'Duna',
      author: 'Frank Herbert',
      totalPages: 680,
      catalogId: 'gb:duneGB0001',
      isbn13: ISBN,
      publisher: 'Aleph',
      publishedYear: 2017,
      coverUrls: [],
    },
  });
}

function detailWithHistory(book: ShelfEntry): ShelfEntryDetail {
  return shelfEntryDetailSchema.parse({
    entry: book,
    sessions: [
      {
        id: 'accepted-session',
        shelfEntryId: book.id,
        startedAt: '2026-10-01T12:00:00.000Z',
        endedAt: '2026-10-01T12:10:00.000Z',
        focusedSeconds: 600,
        startPage: 0,
        endPage: 40,
        pagesRead: 40,
        reflection: 'Minha recordação permanece privada e intacta.',
        recall: null,
        assessment: null,
        localDate: '2026-10-01',
        xpEarned: 10,
      },
    ],
    cards: [
      {
        id: 'existing-card',
        shelfEntryId: book.id,
        bookTitle: book.book.title,
        prompt: 'O que ficou deste trecho?',
        answer: 'Minha resposta original.',
        source: 'manual',
        repetitions: 1,
        intervalDays: 6,
        dueDate: '2026-10-08',
        lastReviewedAt: '2026-10-02T12:00:00.000Z',
      },
    ],
    reviews: [
      {
        id: 'accepted-review',
        cardId: 'existing-card',
        grade: 4,
        localDate: '2026-10-02',
        reviewedAt: '2026-10-02T12:00:00.000Z',
      },
    ],
    reviewTotals: { total: 1, remembered: 1 },
  });
}

function catalog(catalogId: string, isbn13: string | null = ISBN): CatalogBookResponse {
  return catalogBookResponseSchema.parse({
    book: {
      catalogId,
      title: 'Duna',
      subtitle: null,
      authors: ['Frank Herbert'],
      publisher: 'Aleph',
      publishedYear: 2017,
      totalPages: 680,
      isbn13,
      language: 'pt',
      description: 'Descrição da edição do catálogo.',
      coverUrls: [],
      sources: ['google'],
    },
    shelfEntryId: null,
  });
}

describe('API-accepted shelf changes in the mobile cache', () => {
  it('updates status immediately while preserving history, other books and another account', () => {
    const client = createClient();
    const previous = entry('current-book');
    const other = entry('other-book');
    const history = detailWithHistory(previous);
    const shelf = { entries: [other, previous] } satisfies ShelfResponse;
    client.setQueryData(['shelf', USER], shelf);
    client.setQueryData(['shelf', USER, previous.id], history);
    client.setQueryData(['shelf', USER, other.id], detailWithHistory(other));
    client.setQueryData(['shelf', OTHER_USER], shelf);
    client.setQueryData(['shelf', OTHER_USER, previous.id], history);
    client.setQueryData(
      ['catalog', OTHER_USER, 'book', previous.book.catalogId],
      catalog('gb:duneGB0001'),
    );
    const stats = { xpTotal: 10, sessionsCount: 1, lastReadingDate: '2026-10-01' };
    client.setQueryData(['stats', USER, '2026-10-04'], stats);
    const otherDetail = client.getQueryData(['shelf', USER, other.id]);
    const otherAccountCatalog = client.getQueryData([
      'catalog',
      OTHER_USER,
      'book',
      previous.book.catalogId,
    ]);

    const accepted: ShelfEntry = {
      ...previous,
      status: 'finished',
      currentPage: 680,
      finishedAt: '2026-10-04T12:00:00.000Z',
    };
    cacheAcceptedShelfEntry(client, USER, accepted);

    expect(client.getQueryData(['shelf', USER])).toEqual({ entries: [accepted, other] });
    expect(client.getQueryData(['shelf', USER, previous.id])).toEqual({
      ...history,
      entry: accepted,
    });
    expect(client.getQueryData(['shelf', USER, other.id])).toBe(otherDetail);
    expect(client.getQueryData(['shelf', OTHER_USER])).toEqual(shelf);
    expect(client.getQueryData(['shelf', OTHER_USER, previous.id])).toEqual(history);
    expect(client.getQueryData(['catalog', OTHER_USER, 'book', previous.book.catalogId])).toBe(
      otherAccountCatalog,
    );
    expect(client.getQueryData(['stats', USER, '2026-10-04'])).toBe(stats);
  });

  it('inserts a newly accepted book once and does not invent its session history', () => {
    const client = createClient();
    const other = entry('other-book');
    client.setQueryData<ShelfResponse>(['shelf', USER], { entries: [other] });
    const accepted: ShelfEntry = { ...entry('new-book'), status: 'want_to_read', startedAt: null };

    cacheAcceptedShelfEntry(client, USER, accepted);
    cacheAcceptedShelfEntry(client, USER, accepted);

    expect(client.getQueryData(['shelf', USER])).toEqual({ entries: [accepted, other] });
    expect(
      client.getQueryCache().find({ queryKey: ['shelf', USER, accepted.id], exact: true }),
    ).toBeUndefined();
  });

  it('connects cached catalog details and ISBN lookups by catalog id or matching ISBN', () => {
    const client = createClient();
    const accepted = entry('accepted-edition');
    const sameId = catalog('gb:duneGB0001', null);
    const sameIsbn = catalog('ol:OL123M');
    const unrelated = catalog('gb:duneGB0002', '9788535902778');
    const unknownIsbn = catalog('gb:unknownEdition', null);
    const isbnLookup = catalog('isbn:9788576573135');
    const caches = [
      { key: ['catalog', USER, 'book', 'gb:duneGB0001'], value: sameId },
      { key: ['catalog', USER, 'book', 'ol:OL123M'], value: sameIsbn },
      { key: ['catalog', USER, 'isbn', ISBN], value: isbnLookup },
    ];
    for (const { key, value } of caches) client.setQueryData(key, value);
    client.setQueryData(['catalog', USER, 'book', 'gb:duneGB0002'], unrelated);
    client.setQueryData(['catalog', USER, 'book', 'gb:unknownEdition'], unknownIsbn);
    client.setQueryData(['catalog', OTHER_USER, 'isbn', ISBN], isbnLookup);
    const search = { query: 'duna', results: [sameId.book, unrelated.book] };
    client.setQueryData(['catalog', USER, 'search-v2', 'duna'], search);

    cacheAcceptedShelfEntry(client, USER, accepted);

    for (const { key, value } of caches) {
      expect(client.getQueryData(key)).toEqual({ ...value, shelfEntryId: accepted.id });
    }
    expect(client.getQueryData(['catalog', USER, 'book', 'gb:duneGB0002'])).toEqual(unrelated);
    expect(client.getQueryData(['catalog', USER, 'book', 'gb:unknownEdition'])).toEqual(
      unknownIsbn,
    );
    expect(client.getQueryData(['catalog', OTHER_USER, 'isbn', ISBN])).toEqual(isbnLookup);
    expect(client.getQueryData(['catalog', USER, 'search-v2', 'duna'])).toBe(search);
  });

  it('keeps unloaded shelves and details absent even when a matching catalog book is cached', () => {
    const client = createClient();
    const accepted = entry('accepted-book');
    const catalogKey = ['catalog', USER, 'book', 'gb:duneGB0001'];
    client.setQueryData(catalogKey, catalog('gb:duneGB0001'));

    cacheAcceptedShelfEntry(client, USER, accepted);

    expect(client.getQueryData<CatalogBookResponse>(catalogKey)?.shelfEntryId).toBe(accepted.id);
    expect(client.getQueryCache().find({ queryKey: ['shelf', USER], exact: true })).toBeUndefined();
    expect(
      client.getQueryCache().find({ queryKey: ['shelf', USER, accepted.id], exact: true }),
    ).toBeUndefined();
  });

  it('never links two unknown ISBNs when a manual book has no catalog identity', () => {
    const client = createClient();
    const previous = entry('manual-book');
    const accepted: ShelfEntry = {
      ...previous,
      book: { ...previous.book, catalogId: null, isbn13: null },
    };
    const unknown = catalog('gb:unknownEdition', null);
    const catalogKey = ['catalog', USER, 'book', 'gb:unknownEdition'];
    client.setQueryData(catalogKey, unknown);

    cacheAcceptedShelfEntry(client, USER, accepted);

    expect(client.getQueryData(catalogKey)).toEqual(unknown);
  });
});
