import { catalogDiscoverResponseSchema, catalogSearchResponseSchema } from '@bubo/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../mobile/src/lib/auth/client', () => ({ authHeaders: async () => ({}) }));
vi.mock('../../mobile/src/lib/config', () => ({
  publicConfig: { apiUrl: 'http://localhost:8787' },
}));

import { createApiClient } from '../../mobile/src/lib/api/client';
import { createHarness } from './harness';

const DUNA_ISBN = '9788576573135';
const AUTHOR_KEYS: Record<string, string> = { 'Frank Herbert': 'OL79034A' };
const ONBOARDING = {
  readingHabit: 'daily',
  goals: ['remember_more'],
  interests: ['science_fiction'],
  firstBook: null,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** An Open Library work with its selected Portuguese edition. */
function work(
  id: number,
  title: string,
  author: string,
  subjects: string[],
  readers: number,
  edition: { title: string; isbn?: string; cover?: number } = { title },
) {
  return {
    key: `/works/OL${id}W`,
    title,
    author_name: [author],
    author_key: [AUTHOR_KEYS[author] ?? 'OL1A'],
    subject: subjects,
    readinglog_count: readers,
    ratings_average: 4.1,
    editions: {
      docs: [
        {
          key: `/books/OL${id}M`,
          title: edition.title,
          language: ['por'],
          cover_i: edition.cover ?? id,
          isbn: edition.isbn ? [edition.isbn] : [],
        },
      ],
    },
  };
}

const DUNE = work(1, 'Dune', 'Frank Herbert', ['Science fiction', 'Dune (Imaginary place)'], 4400, {
  title: 'Duna',
  isbn: DUNA_ISBN,
});
const MESSIAH = work(
  2,
  'Dune Messiah',
  'Frank Herbert',
  ['Science fiction', 'Dune (Imaginary place)'],
  880,
  {
    title: 'Messias de Duna',
  },
);
const FOUNDATION = work(
  3,
  'Foundation',
  'Isaac Asimov',
  ['Science fiction', 'Galactic empire'],
  3000,
  {
    title: 'Fundação',
  },
);
const HABITS = work(4, 'Atomic Habits', 'James Clear', ['Self-help', 'Habits'], 63000, {
  title: 'Hábitos Atômicos',
});
const HOBBIT = work(5, 'The Hobbit', 'J.R.R. Tolkien', ['Fantasy', 'Dragons'], 5100, {
  title: 'O Hobbit',
});

const communityVolume = (id: string, title: string) => ({
  id,
  volumeInfo: {
    title,
    authors: ['Autora Comunidade'],
    language: 'pt-BR',
    industryIdentifiers: [],
  },
});

function createUpstream() {
  const calls: URL[] = [];
  let openLibraryDown = false;
  let googleQuota = true;
  const fetch = async (input: string) => {
    const url = new URL(input);
    calls.push(url);
    if (url.hostname === 'www.googleapis.com') {
      if (!googleQuota) return json({ error: { code: 429 } }, 429);
      const match = /^\/books\/v1\/volumes\/(\w+)$/.exec(url.pathname);
      if (match?.[1] === 'communityGB1')
        return json(communityVolume('communityGB1', 'Lido Por Dois'));
      if (match?.[1] === 'loneGB00001') return json(communityVolume('loneGB00001', 'Lido Por Um'));
      return json({ totalItems: 0 });
    }
    if (url.hostname === 'openlibrary.org' && url.pathname === '/search.json') {
      if (openLibraryDown) return json({}, 500);
      const q = url.searchParams.get('q') ?? '';
      if (q.includes('isbn:') || q.includes('title:')) return json({ docs: [DUNE] });
      if (q.startsWith('(subject:')) return json({ docs: [DUNE, FOUNDATION, MESSIAH, HABITS] });
      if (q.startsWith('(author')) return json({ docs: [MESSIAH, DUNE] });
      if (q === 'language:por') return json({ docs: [HABITS, DUNE, HOBBIT] });
      if (q.startsWith('subject:"fantasy"')) return json({ docs: [HOBBIT, DUNE] });
      // Free-text search: enough results that no alternative query is needed.
      return json({
        docs: Array.from({ length: 10 }, (_, i) => work(100 + i, `${q} ${i}`, 'A', [], 1)),
      });
    }
    return json({}, 404);
  };
  return {
    fetch,
    calls,
    googleQuotaExhausted: () => {
      googleQuota = false;
    },
    setOpenLibraryDown: (down: boolean) => {
      openLibraryDown = down;
    },
  };
}

let upstream: ReturnType<typeof createUpstream>;
let harness: Awaited<ReturnType<typeof createHarness>>;

beforeEach(async () => {
  upstream = createUpstream();
  harness = await createHarness({ catalogFetch: upstream.fetch });
}, 60_000);
afterEach(async () => {
  await harness.close();
});

async function addManual(cookie: string, title: string, author: string, isbn?: string) {
  const response = await harness.call('/v1/shelf', {
    method: 'POST',
    cookie,
    json: { title, author, isbn, status: 'reading' },
  });
  expect(response.status).toBe(201);
}

async function addCatalog(cookie: string, catalogId: string) {
  const response = await harness.call('/v1/shelf', {
    method: 'POST',
    cookie,
    json: { catalogId, status: 'reading' },
  });
  expect(response.status).toBe(201);
}

async function discover(cookie: string, query = '') {
  const response = await harness.call(`/v1/catalog/discover${query}`, { cookie });
  expect(response.status).toBe(200);
  return catalogDiscoverResponseSchema.parse(await response.json());
}

describe('GET /v1/catalog/discover', () => {
  it('requires a session and a known genre', async () => {
    expect((await harness.call('/v1/catalog/discover')).status).toBe(401);
    const { cookie } = await harness.signUp();
    const invalid = await harness.call('/v1/catalog/discover?genre=astrology', { cookie });
    expect(invalid.status).toBe(422);
  });

  it('recommends Portuguese editions near the shelf, explains them and hides shelf books', async () => {
    const { cookie } = await harness.signUp();
    await addManual(cookie, 'Duna', 'Frank Herbert', DUNA_ISBN);

    const result = await discover(cookie);
    expect(result.basedOn).toEqual({ books: 1, interests: 0 });
    expect(result.sources).toEqual({ openlibrary: 'ok' });

    const forYou = result.sections.find((section) => section.kind === 'for_you');
    expect(forYou?.items.map((entry) => [entry.book.title, entry.reason])).toEqual([
      ['Messias de Duna', 'Mesma autoria de Duna'],
      ['Fundação', 'Ficção científica, como Duna'],
    ]);
    expect(forYou?.items[0]?.book).toMatchObject({ catalogId: 'ol:OL2M', language: 'pt' });

    const popular = result.sections.find((section) => section.kind === 'popular');
    expect(popular?.title).toBe('Mais lidos em português');
    // The reader's own book never comes back, in any section.
    const titles = result.sections.flatMap((section) => section.items.map((e) => e.book.title));
    expect(titles).not.toContain('Duna');
    expect(popular?.items.map((entry) => entry.book.title)).toEqual([
      'Hábitos Atômicos',
      'O Hobbit',
    ]);

    // Every Open Library call asks for Portuguese editions; candidate lists are "most read".
    const searches = upstream.calls.filter((url) => url.pathname === '/search.json');
    expect(searches.every((url) => url.searchParams.get('lang') === 'pt')).toBe(true);
    const candidates = searches.filter((url) => url.searchParams.get('sort') === 'readinglog');
    expect(candidates.every((url) => url.searchParams.get('q')?.includes('language:por'))).toBe(
      true,
    );

    // Authors are queried by their exact Open Library id once the seed resolves.
    expect(searches.map((url) => url.searchParams.get('q'))).toContain(
      '(author_key:OL79034A) AND language:por',
    );

    // Same shelf → cached: no new upstream calls.
    const before = upstream.calls.length;
    await discover(cookie);
    expect(upstream.calls.length).toBe(before);
  });

  it('uses onboarding interests when the shelf is empty', async () => {
    const { cookie } = await harness.signUp();
    const onboarding = await harness.call('/v1/me/onboarding', {
      method: 'PUT',
      cookie,
      json: ONBOARDING,
    });
    expect(onboarding.status).toBe(200);
    const result = await discover(cookie);
    expect(result.basedOn).toEqual({ books: 0, interests: 1 });
    const forYou = result.sections.find((section) => section.kind === 'for_you');
    expect(forYou?.subtitle).toBe('Com base nos seus gêneros');
    expect(forYou?.items[0]?.reason).toBe('Porque você curte ficção científica');
  });

  it('counts "Mais lidos no Bubo" from at least two other readers, never the viewer', async () => {
    const ana = await harness.signUp();
    const bia = await harness.signUp();
    const caio = await harness.signUp();
    await addCatalog(ana.cookie, 'gb:communityGB1');
    await addCatalog(bia.cookie, 'gb:communityGB1');
    await addCatalog(ana.cookie, 'gb:loneGB00001');

    const result = await discover(caio.cookie);
    const community = result.sections.find((section) => section.kind === 'community');
    expect(community?.items.map((entry) => [entry.book.title, entry.readers])).toEqual([
      ['Lido Por Dois', 2],
    ]);

    // A reader who already has the book does not see it as a suggestion.
    const forAna = await discover(ana.cookie);
    expect(forAna.sections.some((section) => section.kind === 'community')).toBe(false);
  });

  it('ranks a genre by popularity and taste, and degrades honestly when the library fails', async () => {
    const { cookie } = await harness.signUp();
    const genre = await discover(cookie, '?genre=fantasy');
    expect(genre.sections).toHaveLength(1);
    expect(genre.sections[0]).toMatchObject({ kind: 'genre', title: 'Mais lidos em fantasia' });
    expect(genre.sections[0]?.items.map((entry) => entry.book.title)).toEqual(['O Hobbit', 'Duna']);

    upstream.setOpenLibraryDown(true);
    const other = await harness.signUp();
    await addManual(other.cookie, 'Outro livro', 'Alguém');
    const degraded = await discover(other.cookie);
    expect(degraded.sources).toEqual({ openlibrary: 'error' });
    expect(degraded.sections).toEqual([]);
    // Failures are logged with source, status and path; never the reader's book titles.
    const failures = harness.logs.lines.filter((line) => line.includes('catalog upstream failed'));
    expect(failures.length).toBeGreaterThan(0);
    const logged = failures.join(' ');
    expect(logged).toContain('"source":"openlibrary"');
    expect(logged).not.toMatch(/outro/i);
  });

  it('is reachable through the mobile client', async () => {
    const { cookie } = await harness.signUp();
    const client = createApiClient({
      baseUrl: 'http://localhost:8787',
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        return harness.call(`${url.pathname}${url.search}`, { headers: request.headers });
      },
      getHeaders: async () => ({ cookie, 'expo-origin': 'bubo://' }),
    });
    const result = await client.getCatalogDiscover('fantasy');
    expect(result.sections[0]?.kind).toBe('genre');
  });
});

describe('catalog search under load', () => {
  it('answers a burst of searches (typing while Discover loads) instead of 503', async () => {
    const { cookie } = await harness.signUp();
    // Four paced Open Library calls: the last waits ~3 s, beyond the old 2 s queue bound.
    const responses = await Promise.all(
      ['har', 'harr', 'harry', 'harry p'].map((q) =>
        harness.call(`/v1/catalog/search?q=${encodeURIComponent(q)}`, { cookie }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200]);
    for (const response of responses) {
      const body = catalogSearchResponseSchema.parse(await response.json());
      expect(body.results.length).toBeGreaterThan(0);
    }
  }, 20_000);

  it('never sends Open Library a query it rejects as too short', async () => {
    const { cookie } = await harness.signUp();
    upstream.googleQuotaExhausted();
    const before = upstream.calls.length;
    const response = await harness.call('/v1/catalog/search?q=ha', { cookie });
    expect(response.status).toBe(200);
    const body = catalogSearchResponseSchema.parse(await response.json());
    expect(body).toMatchObject({
      results: [],
      sources: { google: 'skipped', openlibrary: 'skipped', brasilapi: 'skipped' },
    });
    expect(upstream.calls.length).toBe(before);
  });

  it('skips keyless Google while it backs off instead of reporting every search as partial', async () => {
    const { cookie } = await harness.signUp();
    upstream.googleQuotaExhausted();
    const first = catalogSearchResponseSchema.parse(
      await (await harness.call('/v1/catalog/search?q=harry', { cookie })).json(),
    );
    expect(first.sources.google).toBe('error');
    const second = catalogSearchResponseSchema.parse(
      await (await harness.call('/v1/catalog/search?q=hobbit', { cookie })).json(),
    );
    expect(second.sources).toEqual({ google: 'skipped', openlibrary: 'ok', brasilapi: 'skipped' });
  });
});
