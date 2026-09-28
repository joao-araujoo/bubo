import {
  catalogBookResponseSchema,
  catalogSearchResponseSchema,
  shelfEntrySchema,
  shelfResponseSchema,
} from '@bubo/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

let harness: Awaited<ReturnType<typeof createHarness>>;
const calls: string[] = [];
const imageUrl = 'https://books.google.com/books/content?id=edition001&img=1&zoom=1&fife=w400-h600';
const volume = (id: string, isbn: string, language: string) => ({
  id,
  volumeInfo: {
    title: 'Duna',
    authors: ['Frank Herbert'],
    language,
    publisher: language === 'pt' ? 'Aleph' : 'Ace',
    industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }],
    imageLinks: { thumbnail: imageUrl },
  },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(async () => {
  calls.length = 0;
  harness = await createHarness(
    {
      catalogFetch: async (input) => {
        calls.push(input);
        const url = new URL(input);
        if (url.hostname === 'books.google.com')
          return new Response('image unavailable', { status: 503 });
        if (url.hostname === 'www.googleapis.com') {
          const english = url.pathname.endsWith('english001');
          const book = volume(
            english ? 'english001' : 'edition001',
            english ? '9780441172719' : '9788576573135',
            english ? 'en' : 'pt',
          );
          return json(url.pathname.endsWith('/volumes') ? { items: [book] } : book);
        }
        return url.pathname === '/search.json' ? json({ docs: [] }) : json({}, 404);
      },
    },
    { MEDIA_PUBLIC_URL: 'https://media.example.test' },
  );
}, 60_000);
afterEach(async () => {
  await harness.close();
});

describe('catalog to shelf and media integration', () => {
  it('does not download during search and keeps a useful cover when ingestion fails', async () => {
    const { cookie } = await harness.signUp();
    const response = await harness.call('/v1/catalog/search?q=Duna', { cookie });
    expect(catalogSearchResponseSchema.parse(await response.json()).results).toHaveLength(1);
    expect(calls.some((url) => url.startsWith('https://books.google.com/'))).toBe(false);
    const details = await harness.call('/v1/catalog/books/gb%3Aedition001', { cookie });
    expect(catalogBookResponseSchema.parse(await details.json()).book.coverUrls[0]).toBe(imageUrl);
    const added = await harness.call('/v1/shelf', {
      method: 'POST',
      cookie,
      json: { catalogId: 'gb:edition001' },
    });
    expect(added.status).toBe(201);
    expect(shelfEntrySchema.parse(await added.json()).book.coverUrls[0]).toBe(imageUrl);
    expect(calls.filter((url) => url.startsWith('https://books.google.com/'))).toHaveLength(1);
  });

  it('uses a previously stored cover and persists it through the authenticated shelf flow', async () => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(imageUrl));
    const key = `covers/catalog-v1/${[...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
    // This represents an object already admitted by the ingestion boundary.
    await harness.bindings.MEDIA.put(key, new Uint8Array([1, 2, 3]), {
      httpMetadata: { contentType: 'image/png' },
    });
    const { cookie } = await harness.signUp();
    const added = await harness.call('/v1/shelf', {
      method: 'POST',
      cookie,
      json: { catalogId: 'gb:edition001', cachedCoverUrl: 'https://evil.test/covers' },
    });
    expect(added.status).toBe(201);
    const entry = shelfEntrySchema.parse(await added.json());
    expect(entry.book.coverUrls[0]).toBe(`https://media.example.test/${key}`);
    expect(calls.some((url) => url.startsWith('https://books.google.com/'))).toBe(false);
    const shelf = shelfResponseSchema.parse(
      await (await harness.call('/v1/shelf', { cookie })).json(),
    );
    expect(shelf.entries[0]?.book.coverUrls).toEqual(entry.book.coverUrls);
    const search = catalogSearchResponseSchema.parse(
      await (await harness.call('/v1/catalog/search?q=Duna', { cookie })).json(),
    );
    expect(search.results[0]?.coverUrls[0]).toBe(`https://media.example.test/${key}`);
  });

  it('allows a different edition with the same title without breaking ownership or duplicate checks', async () => {
    const { cookie } = await harness.signUp();
    for (const catalogId of ['gb:edition001', 'gb:english001']) {
      const response = await harness.call('/v1/shelf', {
        method: 'POST',
        cookie,
        json: { catalogId },
      });
      expect(response.status).toBe(201);
    }
    expect(
      (
        await harness.call('/v1/shelf', {
          method: 'POST',
          cookie,
          json: { catalogId: 'gb:edition001' },
        })
      ).status,
    ).toBe(409);
    const shelf = shelfResponseSchema.parse(
      await (await harness.call('/v1/shelf', { cookie })).json(),
    );
    expect(shelf.entries.map((entry) => entry.book.isbn13).sort()).toEqual([
      '9780441172719',
      '9788576573135',
    ]);
    const other = await harness.signUp();
    expect(
      shelfResponseSchema.parse(
        await (await harness.call('/v1/shelf', { cookie: other.cookie })).json(),
      ).entries,
    ).toHaveLength(0);
  });
});
