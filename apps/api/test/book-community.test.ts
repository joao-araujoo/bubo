import { bookCommunitySchema, errorResponseSchema, shelfEntrySchema } from '@bubo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness } from './harness';
import { VALID_SESSION_RECALL } from './session-fixtures';

const NOW = new Date('2026-10-29T15:00:00.000Z');
let h: Awaited<ReturnType<typeof createHarness>>;

beforeAll(async () => {
  h = await createHarness({
    now: () => NOW,
    catalogFetch: async (input) => {
      const url = new URL(input);
      const match = /^\/books\/v1\/volumes\/(comm\d\d)$/.exec(url.pathname);
      if (url.hostname === 'www.googleapis.com' && match) {
        return Response.json({
          id: match[1],
          volumeInfo: {
            title: `Livro ${match[1]}`,
            authors: ['Autora da comunidade'],
            pageCount: 320,
            language: 'pt',
          },
        });
      }
      throw new Error('network disabled in tests');
    },
  });
}, 60_000);
afterAll(async () => {
  await h.close();
});

type Status = 'reading' | 'want_to_read' | 'finished';

async function shelve(cookie: string, volume: string, status: Status) {
  const response = await h.call('/v1/shelf', {
    method: 'POST',
    cookie,
    json: { catalogId: `gb:${volume}`, status },
  });
  expect(response.status).toBe(201);
  return shelfEntrySchema.parse(await response.json());
}

async function patch(cookie: string, id: string, json: Record<string, unknown>) {
  const response = await h.call(`/v1/shelf/${id}`, { method: 'PATCH', cookie, json });
  expect(response.status).toBe(200);
  return shelfEntrySchema.parse(await response.json());
}

const community = async (cookie: string, id: string) => {
  const response = await h.call(`/v1/shelf/${id}/community`, { cookie });
  expect(response.status).toBe(200);
  const body: unknown = await response.json();
  return { raw: body, parsed: bookCommunitySchema.parse(body) };
};

let counter = 0;
const uuid = () => {
  counter += 1;
  return `20000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};

describe('reader marks and "Relendo"', () => {
  it('keeps Favorito/Tenho/Desejado independent of the status', async () => {
    const { cookie } = await h.signUp();
    const entry = await shelve(cookie, 'comm01', 'finished');
    expect(entry).toMatchObject({
      favorite: false,
      owned: false,
      wishlist: false,
      rereading: false,
    });
    expect(entry.addedAt).not.toBeNull();

    const marked = await patch(cookie, entry.id, { favorite: true, owned: true });
    expect(marked).toMatchObject({
      status: 'finished',
      favorite: true,
      owned: true,
      wishlist: false,
    });
    const wished = await patch(cookie, entry.id, { wishlist: true, owned: false });
    expect(wished).toMatchObject({ favorite: true, owned: false, wishlist: true });
  });

  it('lasts only while reading or paused and ends when the re-read is finished', async () => {
    const { cookie } = await h.signUp();
    const entry = await shelve(cookie, 'comm01', 'finished');

    const again = await patch(cookie, entry.id, {
      status: 'reading',
      rereading: true,
      currentPage: 0,
    });
    expect(again).toMatchObject({ status: 'reading', rereading: true, currentPage: 0 });
    expect((await patch(cookie, entry.id, { status: 'paused' })).rereading).toBe(true);
    expect((await patch(cookie, entry.id, { status: 'want_to_read' })).rereading).toBe(false);
    // Asking for it on a book that is not being read keeps it off.
    expect((await patch(cookie, entry.id, { rereading: true })).rereading).toBe(false);

    await patch(cookie, entry.id, { status: 'reading', rereading: true });
    const session = await h.call('/v1/sessions', {
      method: 'POST',
      cookie,
      json: {
        id: uuid(),
        shelfEntryId: entry.id,
        startedAt: '2026-10-29T14:00:00.000Z',
        endedAt: '2026-10-29T14:30:00.000Z',
        focusedSeconds: 25 * 60,
        endPage: 320,
        recall: VALID_SESSION_RECALL,
        localDate: '2026-10-29',
      },
    });
    expect(session.status).toBe(201);
    const shelf = (await (await h.call('/v1/shelf', { cookie })).json()) as {
      entries: unknown[];
    };
    const after = shelfEntrySchema.parse(shelf.entries[0]);
    expect(after).toMatchObject({ status: 'finished', rereading: false });
  });
});

describe('anonymous community numbers of a book', () => {
  it('has none for a manual book or below the floors', async () => {
    const { cookie } = await h.signUp();
    const manual = await h.call('/v1/shelf', {
      method: 'POST',
      cookie,
      json: { title: 'Caderno só meu', totalPages: 80 },
    });
    const manualEntry = shelfEntrySchema.parse(await manual.json());
    expect((await community(cookie, manualEntry.id)).parsed).toEqual({
      readers: null,
      ratings: null,
      alsoRead: [],
    });

    const lonely = await shelve(cookie, 'comm09', 'finished');
    await patch(cookie, lonely.id, { rating: 5 });
    expect((await community(cookie, lonely.id)).parsed).toEqual({
      readers: null,
      ratings: null,
      alsoRead: [],
    });
  });

  it('counts readers, aggregates ratings and lists books also read, never who', async () => {
    const finishers = await Promise.all([1, 2, 3, 4].map(() => h.signUp()));
    const stars = [5, 5, 4, 3];
    for (const [index, reader] of finishers.entries()) {
      const entry = await shelve(reader.cookie, 'comm02', 'finished');
      await patch(reader.cookie, entry.id, { rating: stars[index] });
    }
    for (const reader of finishers.slice(0, 3)) await shelve(reader.cookie, 'comm03', 'finished');
    for (const reader of finishers.slice(0, 2)) await shelve(reader.cookie, 'comm04', 'finished');
    await shelve((finishers[0] as { cookie: string }).cookie, 'comm05', 'finished');

    const curious = await h.signUp();
    await shelve(curious.cookie, 'comm02', 'want_to_read');

    const me = await h.signUp();
    const mine = await shelve(me.cookie, 'comm02', 'reading');
    await patch(me.cookie, mine.id, { rating: 5 });
    await shelve(me.cookie, 'comm04', 'want_to_read');

    const { raw, parsed } = await community(me.cookie, mine.id);
    expect(parsed.readers).toEqual({ finished: 4, reading: 1, wantToRead: 1, abandoned: 0 });
    expect(parsed.ratings).toEqual({
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
    // comm04 is already on my shelf; comm05 was finished by a single reader.
    expect(parsed.alsoRead).toEqual([
      expect.objectContaining({ catalogId: 'gb:comm03', title: 'Livro comm03', percent: 75 }),
    ]);
    expect(Object.keys(raw as object).sort()).toEqual(['alsoRead', 'ratings', 'readers']);
    expect(Object.keys(parsed.alsoRead[0] ?? {}).sort()).toEqual(
      ['author', 'catalogId', 'coverUrls', 'percent', 'title'].sort(),
    );
  });

  it("is scoped to the requester's own shelf entry", async () => {
    const owner = await h.signUp();
    const entry = await shelve(owner.cookie, 'comm01', 'reading');
    const stranger = await h.signUp();
    const response = await h.call(`/v1/shelf/${entry.id}/community`, { cookie: stranger.cookie });
    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(await response.json()).error.code).toBe('NOT_FOUND');
    expect((await h.call(`/v1/shelf/${entry.id}/community`)).status).toBe(401);
  });
});
