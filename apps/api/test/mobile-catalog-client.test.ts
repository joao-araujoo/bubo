import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../mobile/src/lib/auth/client', () => ({ authHeaders: async () => ({}) }));
vi.mock('../../mobile/src/lib/config', () => ({
  publicConfig: { apiUrl: 'http://localhost:8787' },
}));

import { createApiClient } from '../../mobile/src/lib/api/client';
import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
let cookie: string;
const paths: string[] = [];
let outage = false;
const bridge: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  paths.push(`${url.pathname}${url.search}`);
  return h.call(`${url.pathname}${url.search}`, { headers: request.headers });
};
const client = () =>
  createApiClient({
    baseUrl: 'http://localhost:8787',
    fetch: bridge,
    getHeaders: async () => ({ cookie, 'expo-origin': 'bubo://' }),
  });
beforeAll(async () => {
  h = await createHarness({
    catalogFetch: async (input) => {
      const url = new URL(input);
      const q = url.searchParams.get('q') ?? '';
      if (outage) return new Response('{}', { status: 503 });
      const empty = q.includes('zzzznonexistent');
      const data =
        url.hostname === 'www.googleapis.com'
          ? {
              items: empty
                ? []
                : [
                    {
                      id: 'volume0001',
                      volumeInfo: {
                        title: 'Duna',
                        authors: ['Frank Herbert'],
                        industryIdentifiers: [{ type: 'ISBN_13', identifier: '9788576573135' }],
                      },
                    },
                  ],
            }
          : url.pathname === '/search.json'
            ? { docs: [] }
            : null;
      return new Response(JSON.stringify(data ?? {}), { status: data ? 200 : 404 });
    },
  });
  cookie = (await h.signUp()).cookie;
}, 60_000);
afterAll(async () => {
  await h.close();
});

describe('actual mobile catalog client → authenticated API', () => {
  it('uses the catalog route for title/author and forwards the session', async () => {
    expect((await client().searchCatalog('Duna')).results[0]?.title).toBe('Duna');
    expect(paths.at(-1)).toBe('/v1/catalog/search?q=Duna&limit=20');
    expect((await client().searchCatalog('Frank Herbert')).results[0]?.authors).toEqual([
      'Frank Herbert',
    ]);
  });
  it('finds known ISBN-10 and ISBN-13 through the same client', async () => {
    expect((await client().searchCatalog('857657313X')).results[0]?.isbn13).toBe('9788576573135');
    expect((await client().lookupIsbn('9788576573135')).book.isbn13).toBe('9788576573135');
  });
  it('returns empty only for a completed successful search', async () => {
    const result = await client().searchCatalog('zzzznonexistent');
    expect(result.results).toEqual([]);
    expect(result.sources.google).toBe('ok');
    expect(result.sources.openlibrary).toBe('ok');
  });
  it('preserves provider, network and authentication errors', async () => {
    outage = true;
    await expect(client().searchCatalog('new unavailable query')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: 503,
    });
    const anonymous = createApiClient({ baseUrl: 'http://localhost:8787', fetch: bridge });
    await expect(anonymous.searchCatalog('Duna')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    const offline = createApiClient({
      baseUrl: 'http://localhost:8787',
      fetch: async () => {
        throw new TypeError('offline');
      },
    });
    await expect(offline.searchCatalog('Duna')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
