import { type CatalogBook } from '@bubo/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CatalogService,
  mapGoogleVolume,
  mapOpenLibraryDoc,
  mergeResults,
  rankResults,
} from '../src/services/catalog';
import { createLayeredCache, createMemoryCache } from '../src/services/catalog-cache';
import { CatalogTransport } from '../src/services/catalog-transport';

const ISBN = '9788576573135';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const volume = (isbn = ISBN, title = 'Duna', language = 'pt') => ({
  id: 'volume0001',
  volumeInfo: {
    title,
    authors: ['Frank Herbert'],
    language,
    industryIdentifiers: [{ type: isbn.length === 10 ? 'ISBN_10' : 'ISBN_13', identifier: isbn }],
  },
});
function book(overrides: Partial<CatalogBook> = {}): CatalogBook {
  return {
    catalogId: 'gb:volume0001',
    title: 'Duna',
    subtitle: null,
    authors: ['Frank Herbert'],
    publisher: 'Aleph',
    publishedYear: 2017,
    totalPages: null,
    isbn13: null,
    language: 'pt',
    description: null,
    coverUrls: [],
    sources: ['google'],
    ...overrides,
  };
}
afterEach(() => vi.useRealTimers());

describe('catalog coverage and edition identity', () => {
  it('does not cache a partial empty search as absence and recovers on the same query', async () => {
    let failed = true;
    const service = new CatalogService({
      cache: createMemoryCache(),
      fetch: async (input) => {
        if (new URL(input).hostname === 'www.googleapis.com')
          return failed ? json({}, 503) : json({ items: [volume()] });
        return json({ docs: [] });
      },
    });
    await expect(service.search('Duna', 20)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    failed = false;
    expect((await service.search('Duna', 20)).results[0]?.title).toBe('Duna');
  });

  it('rejects malformed provider responses instead of treating them as empty catalogs', async () => {
    const service = new CatalogService({
      cache: createMemoryCache(),
      fetch: async () => json({ unexpected: true }),
    });
    await expect(service.search('Duna', 20)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    expect(await service.getBook('isbn:9788576573134')).toBeNull();
  });
  it('ranks all sources before limiting and resolves the selected Open Library edition', async () => {
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input);
      if (url.hostname === 'www.googleapis.com')
        return json({
          items: Array.from({ length: 40 }, (_, index) => ({
            id: `google${String(index).padStart(4, '0')}`,
            volumeInfo: { title: `Unrelated book ${index}` },
          })),
        });
      if (url.pathname === '/search.json')
        return json({
          docs: [
            {
              key: '/works/OL1W',
              title: 'Dune',
              author_name: ['Frank Herbert'],
              editions: {
                docs: [
                  { key: '/books/OL2M', title: 'Duna', isbn: ['857657313X'], language: ['por'] },
                ],
              },
            },
          ],
        });
      if (url.pathname === '/books/OL2M.json')
        return json({
          title: 'Duna',
          isbn_13: [ISBN],
          number_of_pages: 680,
          publish_date: '2017',
          languages: [{ key: '/languages/por' }],
        });
      return json({}, 404);
    });
    const service = new CatalogService({ fetch, cache: createMemoryCache() });
    const result = await service.search('Duna', 1);
    expect(result.results[0]).toMatchObject({
      catalogId: 'ol:OL2M',
      title: 'Duna',
      totalPages: null,
    });
    expect(await service.getBook('ol:OL2M')).toMatchObject({
      title: 'Duna',
      totalPages: 680,
      publishedYear: 2017,
    });
    expect(fetch.mock.calls.some(([url]) => url.includes('/books/OL2M.json'))).toBe(true);
  });

  it('uses an author-specific alternative and rejects invalid ISBN queries before fetching', async () => {
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input);
      if (url.hostname === 'openlibrary.org') return json({ docs: [] });
      return json({ items: url.searchParams.get('q')?.startsWith('inauthor:') ? [volume()] : [] });
    });
    const service = new CatalogService({ fetch, cache: createMemoryCache() });
    await expect(service.search('9788576573136', 10)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect((await service.search('Frank Herbert', 10)).results[0]).toMatchObject({
      title: 'Duna',
      match: 'exact',
    });
  });
  it('deduplicates equivalent ISBNs but preserves formats, languages and different authors', () => {
    const google = mapGoogleVolume(volume('857657313X'));
    expect(google?.isbn13).toBe(ISBN);
    const books = [
      book({ isbn13: ISBN }),
      book({ catalogId: 'ol:OL1M', isbn13: ISBN, sources: ['openlibrary'] }),
      book({ catalogId: 'gb:english01', isbn13: '9780441172719', language: 'en' }),
      book({ catalogId: 'gb:another01', authors: ['Brian Herbert'] }),
    ];
    expect(mergeResults([books], 10)).toHaveLength(3);
    expect(mergeResults([books], 10)[0]?.sources).toEqual(['google', 'openlibrary']);
    expect(
      mergeResults([[book(), book({ catalogId: 'ol:OL2M', format: 'Digital' })]], 10),
    ).toHaveLength(2);
    expect(
      mergeResults([[book(), book({ catalogId: 'ol:OL2M', language: 'en' })]], 10),
    ).toHaveLength(2);
    expect(mergeResults([[book(), book({ catalogId: 'ol:OL2M' })]], 10)).toHaveLength(1);
  });

  it('does not borrow a work cover, median pages or original year for an edition', () => {
    const mapped = mapOpenLibraryDoc({
      key: '/works/OL1W',
      title: 'Dune',
      author_name: ['Frank Herbert'],
      first_publish_year: 1965,
      number_of_pages_median: 400,
      publisher: ['Other'],
      cover_i: 123,
      editions: {
        docs: [{ key: '/books/OL2M', title: 'Duna', language: ['por'], isbn: ['857657313X'] }],
      },
    });
    expect(mapped).toMatchObject({
      catalogId: 'ol:OL2M',
      title: 'Duna',
      isbn13: ISBN,
      publishedYear: null,
      totalPages: null,
      publisher: null,
      coverUrls: [],
    });
  });

  it('ranks title and author coverage ahead of language and uses query language hints', () => {
    const english = book({ catalogId: 'gb:english01', title: 'The Hobbit', language: 'en' });
    const portuguese = book({ title: 'The Hobbit', language: 'pt' });
    expect(rankResults([portuguese, english], 'The Hobbit')[0]).toBe(english);
    expect(
      rankResults([book({ title: 'Duna', authors: ['Outra Pessoa'] }), book()], 'Frank Herbert')[0]
        ?.authors,
    ).toEqual(['Frank Herbert']);
    expect(
      rankResults([book({ title: 'Duna comentada' }), book({ language: 'en' })], 'Duna')[0]?.title,
    ).toBe('Duna');
  });

  it('retries weak title/author queries, marks approximations, and shares normalized cache', async () => {
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input);
      if (url.hostname === 'openlibrary.org') return json({ docs: [] });
      const alternate = url.searchParams.get('q')?.includes('intitle:');
      return json({
        items: [
          {
            ...volume(ISBN, alternate ? 'Memorias Postumas' : 'Memórias de outro autor'),
            id: alternate ? 'correct0001' : 'other00001',
            volumeInfo: { title: alternate ? 'Memorias Postumas' : 'Memórias de outro autor' },
          },
        ],
      });
    });
    const service = new CatalogService({ fetch, cache: createMemoryCache() });
    const result = await service.search('  Memórias   Póstumas ', 20);
    expect(result.results[0]).toMatchObject({ title: 'Memorias Postumas', match: 'exact' });
    expect(
      fetch.mock.calls.some(([url]) => new URL(url).searchParams.get('q')?.includes('intitle:')),
    ).toBe(true);
    const count = fetch.mock.calls.length;
    await service.search('MEMÓRIAS PÓSTUMAS', 20);
    expect(fetch).toHaveBeenCalledTimes(count);
    const weak = new CatalogService({
      fetch: async (url) =>
        url.includes('googleapis')
          ? json({ items: [volume(ISBN, 'Livro sem relação')] })
          : json({ docs: [] }),
      cache: createMemoryCache(),
    });
    expect((await weak.search('Frank Herbert desconhecido', 20)).results[0]?.match).toBe(
      'approximate',
    );
  });

  it('finds ISBN-13 through its ISBN-10 equivalent and reuses the canonical lookup', async () => {
    const fetch = vi.fn(async (input: string) => {
      const url = new URL(input);
      if (url.hostname === 'www.googleapis.com')
        return json({
          items: url.searchParams.get('q') === 'isbn:857657313X' ? [volume('857657313X')] : [],
        });
      return json({}, 404);
    });
    const service = new CatalogService({ fetch, cache: createMemoryCache() });
    expect(await service.lookupIsbn(ISBN)).toMatchObject({ isbn13: ISBN, match: 'exact' });
    const count = fetch.mock.calls.length;
    expect(await service.lookupIsbn('ISBN-10: 857657313x')).toMatchObject({ isbn13: ISBN });
    expect(fetch).toHaveBeenCalledTimes(count);
  });

  it('adds BrasilAPI coverage without guessing language or accepting another ISBN', async () => {
    const fetch = vi.fn(async (input: string) =>
      input.includes('brasilapi')
        ? json({
            isbn: '857657313X',
            title: 'Duna',
            authors: ['Frank Herbert'],
            year: 2017,
            format: 'PHYSICAL',
            cover_url: 'https://untrusted.example/cover.png',
          })
        : input.includes('googleapis')
          ? json({ items: [] })
          : json({}, 404),
    );
    const service = new CatalogService({ fetch, cache: createMemoryCache() });
    expect(await service.lookupIsbn(ISBN)).toMatchObject({
      title: 'Duna',
      sources: ['brasilapi'],
      language: null,
      format: 'PHYSICAL',
    });
    expect(fetch.mock.calls.find(([url]) => url.includes('brasilapi'))?.[0]).toContain(
      'providers=cbl,mercado-editorial',
    );
    const different = new CatalogService({
      fetch: async (url) =>
        url.includes('brasilapi')
          ? json({ isbn: '9788535902778', title: 'Outro livro' })
          : url.includes('googleapis')
            ? json({ items: [volume('9780441172719')] })
            : json({ title: 'Wrong edition', isbn_13: ['9780441172719'] }),
      cache: createMemoryCache(),
    });
    expect(await different.lookupIsbn(ISBN)).toBeNull();
  });

  it('retains successful ISBN results during provider failure and never negative-caches a partial miss', async () => {
    let down = true;
    const fetch = vi.fn(async (url: string) => {
      if (url.includes('brasilapi'))
        return down ? json({}, 500) : json({ isbn: ISBN, title: 'Recovered' });
      return url.includes('googleapis') ? json({ items: [] }) : json({}, 404);
    });
    const service = new CatalogService({ fetch, cache: createMemoryCache() });
    await expect(service.lookupIsbn(ISBN)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    down = false;
    expect(await service.lookupIsbn(ISBN)).toMatchObject({ title: 'Recovered' });
    const partial = new CatalogService({
      fetch: async (url) =>
        url.includes('googleapis') ? json({ items: [volume()] }) : json({}, 500),
      cache: createMemoryCache(),
    });
    const result = await partial.search(ISBN, 20);
    expect(result.results).toHaveLength(1);
    expect(result.sources).toMatchObject({
      google: 'ok',
      openlibrary: 'error',
      brasilapi: 'error',
    });
  });

  it('does not let title search populate the exact ISBN lookup cache', async () => {
    const service = new CatalogService({
      cache: createMemoryCache(),
      fetch: async (input) => {
        const url = new URL(input);
        if (url.hostname === 'www.googleapis.com')
          return json({ items: url.searchParams.get('q')?.startsWith('isbn:') ? [] : [volume()] });
        return url.pathname === '/search.json' ? json({ docs: [] }) : json({}, 404);
      },
    });
    expect((await service.search('Duna', 10)).results).toHaveLength(1);
    expect(await service.lookupIsbn(ISBN)).toBeNull();
  });
});

describe('provider resource boundaries', () => {
  it('times out an uncooperative provider and coalesces concurrent requests', async () => {
    const fetch = vi.fn(() => new Promise<Response>(() => undefined));
    const cache = createMemoryCache();
    const transport = new CatalogTransport({ fetch, cache, timeoutMs: 15 });
    const results = await Promise.all([
      transport.get('https://openlibrary.org/search.json?q=test', 'openlibrary'),
      transport.get('https://openlibrary.org/search.json?q=test', 'openlibrary'),
    ]);
    expect(results).toEqual([
      { ok: false, status: 0 },
      { ok: false, status: 0 },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('honors Retry-After independently per source', async () => {
    const fetch = vi.fn(
      async () => new Response('', { status: 429, headers: { 'retry-after': '120' } }),
    );
    const transport = new CatalogTransport({ fetch, cache: createMemoryCache(), timeoutMs: 100 });
    await transport.get('https://openlibrary.org/a', 'openlibrary');
    await transport.get('https://openlibrary.org/b', 'openlibrary');
    expect(fetch).toHaveBeenCalledTimes(1);
    await transport.get('https://brasilapi.com.br/c', 'brasilapi');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not extend an expired edge entry by its original TTL', async () => {
    vi.useFakeTimers();
    const store = new Map<string, Response>();
    const edge = {
      match: async (key: string) => store.get(key)?.clone(),
      put: async (key: string, value: Response) => {
        store.set(key, value);
      },
    };
    await createLayeredCache(createMemoryCache(), edge).set('book', { value: 1 }, 5);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await createLayeredCache(createMemoryCache(), edge).get('book')).toBeUndefined();
  });
});
