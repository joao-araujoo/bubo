import {
  catalogBookResponseSchema,
  catalogSearchResponseSchema,
  errorResponseSchema,
  shelfEntrySchema,
  shelfResponseSchema,
} from '@bubo/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createLayeredCache, createMemoryCache } from '../src/services/catalog-cache';
import {
  mapOpenLibraryDoc,
  mergeResults,
  plainDescription,
  rankResults,
} from '../src/services/catalog';
import { createHarness } from './harness';

const DUNA_ISBN = '9788576573135';
const OTHER_ISBN = '9788535902778';
const GOOGLE_THUMB =
  'http://books.google.com/books/content?id=duneGB0001&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api';

const googleSearch = {
  items: [
    {
      id: 'duneGB0001',
      volumeInfo: {
        title: 'Duna',
        authors: ['Frank Herbert'],
        publisher: 'Aleph',
        publishedDate: '2017-03-01',
        pageCount: 680,
        language: 'pt-BR',
        description: '<p>Uma <b>obra-prima</b> &amp; clássico.</p><p>Arrakis.</p>',
        industryIdentifiers: [{ type: 'ISBN_13', identifier: DUNA_ISBN }],
        imageLinks: { thumbnail: GOOGLE_THUMB },
      },
    },
    // A different edition must remain selectable.
    {
      id: 'duneGB0002',
      volumeInfo: { title: 'Duna: Edição especial', authors: ['Frank Herbert'] },
    },
    { id: 'messiasGB01', volumeInfo: { title: 'O Messias de Duna', authors: ['Frank Herbert'] } },
    // Invalid or hostile items never reach clients.
    { id: 'x', volumeInfo: { title: 'Too short id' } },
    { volumeInfo: { title: 'No id' } },
    {
      id: 'evilGB0001',
      volumeInfo: { title: 'Evil', imageLinks: { thumbnail: 'https://evil.example/x.jpg' } },
    },
  ],
};

const openLibrarySearch = {
  docs: [
    { key: '/works/OL893415W', title: 'Dune', author_name: ['Frank Herbert'], cover_i: 11481354 },
    {
      key: '/works/OL100W',
      title: 'Duna',
      author_name: ['Frank Herbert'],
      cover_i: 42,
      number_of_pages_median: 500,
    },
    { key: '/books/OL1M', title: 'Edition, not a work' },
  ],
};

type Route = (url: URL) => Response | undefined;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Fake upstream: Google Books + Open Library, with per-test overrides and a call log. */
function createUpstream() {
  const calls: string[] = [];
  const overrides: Route[] = [];
  const routes: Route = (url) => {
    if (url.hostname === 'brasilapi.com.br') return json({}, 404);
    if (url.hostname === 'www.googleapis.com') {
      if (url.pathname === '/books/v1/volumes') {
        const q = url.searchParams.get('q') ?? '';
        if (q === `isbn:${DUNA_ISBN}`) return json({ items: [googleSearch.items[0]] });
        if (q.startsWith('isbn:')) return json({ totalItems: 0 });
        return json(googleSearch);
      }
      if (url.pathname === '/books/v1/volumes/duneGB0001') return json(googleSearch.items[0]);
      return json({ error: { code: 404 } }, 404);
    }
    if (url.hostname === 'openlibrary.org') {
      if (url.pathname === '/search.json') return json(openLibrarySearch);
      if (url.pathname === '/works/OL893415W.json') {
        return json({
          title: 'Dune',
          description: { value: 'Set on the desert planet Arrakis.' },
          covers: [11481354],
          first_publish_date: '1965',
          authors: [{ author: { key: '/authors/OL79034A' } }],
        });
      }
      if (url.pathname === '/authors/OL79034A.json') return json({ name: 'Frank Herbert' });
      return json({ error: 'notfound' }, 404);
    }
    return undefined;
  };
  const fetch = async (input: string) => {
    calls.push(input);
    const url = new URL(input);
    for (const override of overrides) {
      const response = override(url);
      if (response) return response;
    }
    const response = routes(url);
    if (!response) throw new Error(`unexpected upstream ${url.hostname}`);
    return response;
  };
  return { fetch, calls, overrides };
}

let upstream: ReturnType<typeof createUpstream>;
let harness: Awaited<ReturnType<typeof createHarness>>;

// A fresh PGlite database per test: allow the same startup time as the other suites' beforeAll.
beforeEach(async () => {
  upstream = createUpstream();
  harness = await createHarness({ catalogFetch: upstream.fetch });
}, 60_000);
afterEach(async () => {
  await harness.close();
});

async function search(cookie: string, q: string) {
  return harness.call(`/v1/catalog/search?q=${encodeURIComponent(q)}`, { cookie });
}

describe('catalog search', () => {
  it('requires a session and a real query', async () => {
    expect((await harness.call('/v1/catalog/search?q=duna')).status).toBe(401);
    const { cookie } = await harness.signUp();
    const short = await search(cookie, 'd');
    expect(short.status).toBe(422);
    expect(errorResponseSchema.parse(await short.json()).error.code).toBe('VALIDATION_FAILED');
  });

  it('combines sources, preserves editions, hardens covers and caches', async () => {
    const { cookie } = await harness.signUp();
    const response = await search(cookie, 'duna');
    expect(response.status).toBe(200);
    const body = catalogSearchResponseSchema.parse(await response.json());
    expect(body.sources).toEqual({ google: 'ok', openlibrary: 'ok', brasilapi: 'skipped' });

    const [duna, ...rest] = body.results;
    expect(duna).toMatchObject({
      catalogId: 'gb:duneGB0001',
      title: 'Duna',
      authors: ['Frank Herbert'],
      publisher: 'Aleph',
      publishedYear: 2017,
      totalPages: 680,
      isbn13: DUNA_ISBN,
      sources: ['google'],
      description: 'Uma obra-prima & clássico.\n\nArrakis.',
    });
    // Google (https, flat, larger) → Open Library by cover id → Open Library by ISBN (last).
    expect(duna?.coverUrls).toEqual([
      'https://books.google.com/books/content?id=duneGB0001&printsec=frontcover&img=1&source=gbs_api&zoom=1&fife=w400-h600',
      `https://covers.openlibrary.org/b/isbn/${DUNA_ISBN}-L.jpg?default=false`,
    ]);
    const ids = body.results.map((book) => book.catalogId);
    // Relevance: exact title first; titles that match no query word go last.
    expect(ids).toEqual([
      'gb:duneGB0001',
      'ol:OL100W',
      'gb:duneGB0002',
      'gb:messiasGB01',
      'ol:OL893415W',
      'gb:evilGB0001',
    ]);
    expect(rest.find((book) => book.catalogId === 'gb:evilGB0001')?.coverUrls).toEqual([]);
    for (const book of body.results) {
      for (const url of book.coverUrls)
        expect(url).toMatch(/^https:\/\/(books\.google|covers\.openlibrary)/);
    }

    const before = upstream.calls.length;
    expect((await search(cookie, '  DUNA ')).status).toBe(200);
    expect(upstream.calls.length).toBe(before);
    // Opening a result reuses what the search just returned.
    const details = await harness.call('/v1/catalog/books/gb%3AduneGB0001', { cookie });
    expect(catalogBookResponseSchema.parse(await details.json())).toMatchObject({
      book: { catalogId: 'gb:duneGB0001' },
      shelfEntryId: null,
    });
    expect(upstream.calls.length).toBe(before);
  });

  it('returns partial results when one source fails and 503 when both do', async () => {
    const { cookie } = await harness.signUp();
    upstream.overrides.push((url) =>
      url.hostname === 'www.googleapis.com' ? json({ error: { code: 429 } }, 429) : undefined,
    );
    const partial = catalogSearchResponseSchema.parse(await (await search(cookie, 'duna')).json());
    expect(partial.sources).toEqual({ google: 'error', openlibrary: 'ok', brasilapi: 'skipped' });
    expect(partial.results.map((book) => book.catalogId)).toEqual(['ol:OL100W', 'ol:OL893415W']);

    // Google is now in back-off (not even called); Open Library down too → 503.
    const googleCalls = upstream.calls.filter((call) => call.includes('googleapis')).length;
    upstream.overrides.push((url) =>
      url.hostname === 'openlibrary.org' ? json({}, 500) : undefined,
    );
    const down = await search(cookie, 'outro livro');
    expect(upstream.calls.filter((call) => call.includes('googleapis')).length).toBe(googleCalls);
    expect(down.status).toBe(503);
    expect(errorResponseSchema.parse(await down.json()).error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('treats an ISBN query as an ISBN lookup', async () => {
    const { cookie } = await harness.signUp();
    upstream.overrides.push((url) =>
      url.pathname === `/isbn/${OTHER_ISBN}.json`
        ? json({
            isbn_13: [OTHER_ISBN],
            title: 'Memórias Póstumas de Brás Cubas',
            authors: [{ key: '/authors/OL1A' }],
            publishers: ['Penguin'],
            publish_date: '2014',
            number_of_pages: 368,
            covers: [7],
            languages: [{ key: '/languages/por' }],
          })
        : url.pathname === '/authors/OL1A.json'
          ? json({ name: 'Machado de Assis' })
          : undefined,
    );
    const body = catalogSearchResponseSchema.parse(
      await (await search(cookie, '85-359-0277-5')).json(),
    );
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      catalogId: `isbn:${OTHER_ISBN}`,
      title: 'Memórias Póstumas de Brás Cubas',
      authors: ['Machado de Assis'],
      publisher: 'Penguin',
      language: 'pt',
      isbn13: OTHER_ISBN,
      totalPages: 368,
    });
  });
});

describe('catalog ISBN lookup and details', () => {
  it('only accepts a Google volume that really carries the ISBN', async () => {
    const { cookie } = await harness.signUp();
    upstream.overrides.push((url) => {
      if (url.hostname === 'www.googleapis.com' && url.searchParams.get('q')?.startsWith('isbn:')) {
        // Fuzzy match with a different ISBN: must be ignored.
        return json({ items: [googleSearch.items[0]] });
      }
      if (url.pathname === `/isbn/${OTHER_ISBN}.json`) {
        return json({ title: 'Dom Casmurro', isbn_13: [OTHER_ISBN], covers: [9] });
      }
      return undefined;
    });
    const response = await harness.call(`/v1/catalog/isbn/${OTHER_ISBN}`, { cookie });
    expect(response.status).toBe(200);
    const { book } = catalogBookResponseSchema.parse(await response.json());
    expect(book).toMatchObject({ title: 'Dom Casmurro', sources: ['openlibrary'] });
    expect(book.coverUrls).toEqual([
      'https://covers.openlibrary.org/b/id/9-L.jpg?default=false',
      `https://covers.openlibrary.org/b/isbn/${OTHER_ISBN}-L.jpg?default=false`,
    ]);
  });

  it('rejects invalid ISBNs and reports unknown ones', async () => {
    const { cookie } = await harness.signUp();
    expect((await harness.call('/v1/catalog/isbn/9788576573136', { cookie })).status).toBe(422);
    expect((await harness.call(`/v1/catalog/isbn/${OTHER_ISBN}`, { cookie })).status).toBe(404);
    expect((await harness.call('/v1/catalog/books/evil%3Aid', { cookie })).status).toBe(404);
    expect((await harness.call('/v1/catalog/books/gb%3AunknownGB1', { cookie })).status).toBe(404);
  });

  it('loads an Open Library work with its authors and cover', async () => {
    const { cookie } = await harness.signUp();
    const response = await harness.call('/v1/catalog/books/ol%3AOL893415W', { cookie });
    const { book } = catalogBookResponseSchema.parse(await response.json());
    expect(book).toMatchObject({
      title: 'Dune',
      authors: ['Frank Herbert'],
      publishedYear: null,
      description: 'Set on the desert planet Arrakis.',
      coverUrls: ['https://covers.openlibrary.org/b/id/11481354-L.jpg?default=false'],
    });
  });

  it('rate-limits a single reader', async () => {
    const { cookie } = await harness.signUp();
    let last = 200;
    for (let i = 0; i < 61; i += 1) {
      last = (await harness.call('/v1/catalog/books/ol%3AOL893415W', { cookie })).status;
    }
    expect(last).toBe(429);
  });
});

describe('adding catalog books', () => {
  it('resolves metadata server-side, shares the row and keeps per-reader page counts', async () => {
    const ana = await harness.signUp();
    const bia = await harness.signUp();

    const add = (cookie: string, body: unknown) =>
      harness.call('/v1/shelf', { method: 'POST', cookie, json: body });

    const created = await add(ana.cookie, {
      catalogId: 'gb:duneGB0001',
      status: 'reading',
      // Client-sent metadata is ignored.
      title: 'Hacked',
      coverUrls: ['https://evil.example/x.jpg'],
    });
    expect(created.status).toBe(201);
    const entry = shelfEntrySchema.parse(await created.json());
    expect(entry.status).toBe('reading');
    expect(entry.book).toMatchObject({
      title: 'Duna',
      author: 'Frank Herbert',
      totalPages: 680,
      catalogId: 'gb:duneGB0001',
      isbn13: DUNA_ISBN,
      publisher: 'Aleph',
      publishedYear: 2017,
    });
    expect(entry.book.coverUrls[0]).toMatch(/^https:\/\/books\.google\.com\//);
    expect(entry.book.coverUrls.at(-1)).toBe(
      `https://covers.openlibrary.org/b/isbn/${DUNA_ISBN}-L.jpg?default=false`,
    );

    // Same book again (by id, or by ISBN through another catalog id) → conflict.
    expect((await add(ana.cookie, { catalogId: 'gb:duneGB0001' })).status).toBe(409);
    expect((await add(ana.cookie, { catalogId: `isbn:${DUNA_ISBN}` })).status).toBe(409);

    const biaEntry = shelfEntrySchema.parse(
      await (await add(bia.cookie, { catalogId: 'gb:duneGB0001' })).json(),
    );
    expect(biaEntry.book.id).toBe(entry.book.id);
    expect(biaEntry.status).toBe('want_to_read');

    const details = catalogBookResponseSchema.parse(
      await (
        await harness.call('/v1/catalog/books/gb%3AduneGB0001', { cookie: ana.cookie })
      ).json(),
    );
    expect(details.shelfEntryId).toBe(entry.id);

    // Ana's own page count does not touch Bia's copy of the shared book.
    const patched = await harness.call(`/v1/shelf/${entry.id}`, {
      method: 'PATCH',
      cookie: ana.cookie,
      json: { totalPages: 700 },
    });
    expect(patched.status).toBe(200);
    expect(shelfEntrySchema.parse(await patched.json()).book.totalPages).toBe(700);
    const biaShelf = shelfResponseSchema.parse(
      await (await harness.call('/v1/shelf', { cookie: bia.cookie })).json(),
    );
    expect(biaShelf.entries[0]?.book.totalPages).toBe(680);

    // Removing it from Ana's shelf keeps the shared row for Bia.
    expect(
      (await harness.call(`/v1/shelf/${entry.id}`, { method: 'DELETE', cookie: ana.cookie }))
        .status,
    ).toBe(200);
    const again = shelfResponseSchema.parse(
      await (await harness.call('/v1/shelf', { cookie: bia.cookie })).json(),
    );
    expect(again.entries[0]?.book.title).toBe('Duna');
  });

  it('returns 404 for unknown catalog ids and keeps manual books working', async () => {
    const { cookie } = await harness.signUp();
    const missing = await harness.call('/v1/shelf', {
      method: 'POST',
      cookie,
      json: { catalogId: 'gb:unknownGB1' },
    });
    expect(missing.status).toBe(404);
    const manual = await harness.call('/v1/shelf', {
      method: 'POST',
      cookie,
      json: { title: 'Meu caderno', totalPages: 90 },
    });
    expect(manual.status).toBe(201);
    expect(shelfEntrySchema.parse(await manual.json()).book).toMatchObject({
      catalogId: null,
      coverUrls: [],
    });
    const withIsbn = await harness.call('/v1/shelf', {
      method: 'POST',
      cookie,
      json: {
        title: 'Dom Casmurro',
        publisher: 'Penguin',
        publishedYear: 2016,
        isbn: '85-359-0277-5',
      },
    });
    expect(withIsbn.status).toBe(201);
    expect(shelfEntrySchema.parse(await withIsbn.json()).book).toMatchObject({
      isbn13: OTHER_ISBN,
      publisher: 'Penguin',
      publishedYear: 2016,
      coverUrls: [`https://covers.openlibrary.org/b/isbn/${OTHER_ISBN}-L.jpg?default=false`],
    });
    const badIsbn = await harness.call('/v1/shelf', {
      method: 'POST',
      cookie,
      json: { title: 'Outro', isbn: '123' },
    });
    expect(badIsbn.status).toBe(422);
  });

  it('accepts a catalog pick as the onboarding first book', async () => {
    const { cookie } = await harness.signUp();
    const response = await harness.call('/v1/me/onboarding', {
      method: 'PUT',
      cookie,
      json: {
        readingHabit: 'daily',
        goals: ['remember_more'],
        interests: ['fantasy'],
        firstBook: { catalogId: 'gb:duneGB0001' },
      },
    });
    expect(response.status).toBe(200);
    const shelf = shelfResponseSchema.parse(
      await (await harness.call('/v1/shelf', { cookie })).json(),
    );
    expect(shelf.entries).toHaveLength(1);
    expect(shelf.entries[0]).toMatchObject({ status: 'reading', book: { title: 'Duna' } });
  });
});

describe('catalog helpers', () => {
  it('turns HTML descriptions into plain paragraphs', () => {
    expect(plainDescription('Linha 1<br>Linha 2<p>Outro &quot;parágrafo&quot;</p>')).toBe(
      'Linha 1 Linha 2\n\nOutro "parágrafo"',
    );
    expect(plainDescription('<p></p>')).toBeNull();
  });

  it('uses the best-matching Portuguese edition of an Open Library work', () => {
    const book = mapOpenLibraryDoc({
      key: '/works/OL893414W',
      title: 'Dune',
      author_name: ['Frank Herbert'],
      cover_i: 1,
      edition_count: 155,
      editions: {
        docs: [
          {
            key: '/books/OL123M',
            title: 'Duna',
            language: ['por'],
            cover_i: 2,
            isbn: ['857657313X'],
            publisher: ['Aleph'],
          },
        ],
      },
    });
    expect(book).toMatchObject({
      catalogId: 'ol:OL123M',
      title: 'Duna',
      language: 'pt',
      publisher: 'Aleph',
      isbn13: DUNA_ISBN,
      coverUrls: ['https://covers.openlibrary.org/b/id/2-L.jpg?default=false'],
    });
  });

  it('ranks exact titles and popular works first', () => {
    const make = (catalogId: string, title: string, authors: string[]) => ({
      catalogId,
      title,
      subtitle: null,
      authors,
      publisher: null,
      publishedYear: null,
      totalPages: null,
      isbn13: null,
      language: null,
      description: null,
      coverUrls: [],
      sources: ['openlibrary' as const],
    });
    const books = [
      make('ol:OL1W', 'Born a Crime', ['Trevor Noah']),
      make('ol:OL2W', 'Duna', ['Autora Desconhecida']),
      make('ol:OL3W', 'Duna', ['Frank Herbert']),
    ];
    const popularity = new Map([['duna|herbert', 155]]);
    expect(rankResults(books, 'duna', popularity).map((b) => b.catalogId)).toEqual([
      'ol:OL3W',
      'ol:OL2W',
      'ol:OL1W',
    ]);
  });

  it('does not merge incomplete records using title and surname alone', () => {
    const book = (catalogId: string, title: string, covers: string[] = []) => ({
      catalogId,
      title,
      subtitle: null,
      authors: ['A. Autor'],
      publisher: null,
      publishedYear: null,
      totalPages: null,
      isbn13: null,
      language: null,
      description: null,
      coverUrls: covers,
      sources: ['google' as const],
    });
    const merged = mergeResults(
      [
        [book('gb:aaaaaaaa', 'Sem capa'), book('gb:bbbbbbbb', 'Com capa', ['https://x/y.jpg'])],
        [book('ol:OL1W', 'Sem Capa', ['https://covers.openlibrary.org/b/id/1-L.jpg'])],
      ],
      10,
    );
    expect(merged.map((b) => b.catalogId)).toEqual(['gb:aaaaaaaa', 'gb:bbbbbbbb', 'ol:OL1W']);
    expect(merged[0]?.coverUrls).toEqual([]);
  });

  it('expires and evicts memory cache entries, and falls back to the edge cache', async () => {
    let now = 0;
    const memory = createMemoryCache({ maxEntries: 2, now: () => now });
    await memory.set('a', 1, 10);
    await memory.set('b', 2, 10);
    await memory.get('a');
    await memory.set('c', 3, 10);
    expect(await memory.get('b')).toBeUndefined();
    expect(await memory.get('a')).toBe(1);
    now = 11_000;
    expect(await memory.get('a')).toBeUndefined();

    const store = new Map<string, Response>();
    const edge = {
      match: async (url: string) => store.get(url)?.clone(),
      put: async (url: string, response: Response) => {
        store.set(url, response);
      },
    };
    const layered = createLayeredCache(createMemoryCache(), edge);
    await layered.set('k', { ok: true }, 60);
    const fresh = createLayeredCache(createMemoryCache(), edge);
    expect(await fresh.get('k')).toEqual({ ok: true });
  });
});
