import { type StatsResponse, statsResponseSchema } from '@bubo/contracts';
import { selectTodayAction } from '@bubo/domain';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../mobile/src/lib/auth/client', () => ({ authHeaders: async () => ({}) }));
vi.mock('../../mobile/src/lib/config', () => ({
  publicConfig: { apiUrl: 'http://localhost:8787' },
}));

import { type ApiClient, createApiClient } from '../../mobile/src/lib/api/client';
import { createHarness } from './harness';
import { VALID_SESSION_RECALL } from './session-fixtures';

const TODAY = '2026-10-04';
let h: Awaited<ReturnType<typeof createHarness>>;

const bridge: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  return h.call(`${url.pathname}${url.search}`, {
    method: request.method,
    headers: request.headers,
    body: request.method === 'GET' ? undefined : await request.text(),
  });
};

const clientFor = (cookie: string, fetchImpl: typeof fetch = bridge) =>
  createApiClient({
    baseUrl: 'http://localhost:8787',
    fetch: fetchImpl,
    getHeaders: async () => ({ cookie, 'expo-origin': 'bubo://' }),
  });

beforeAll(async () => {
  h = await createHarness({ now: () => new Date(`${TODAY}T12:00:00Z`) });
}, 60_000);
afterAll(async () => h.close());

async function reader() {
  const { cookie } = await h.signUp();
  const client = clientFor(cookie);
  return { cookie, client, id: (await client.getMe()).user.id };
}

async function todayInput(client: ApiClient) {
  const [shelf, stats, due] = await Promise.all([
    client.getShelf(),
    client.getStats(TODAY),
    client.getDueCards(TODAY),
  ]);
  return {
    today: TODAY,
    draft: { state: 'ready' as const, value: null },
    readingEntryId: {
      state: 'ready' as const,
      value: shelf.entries.find((entry) => entry.status === 'reading')?.id ?? null,
    },
    reading: { state: 'ready' as const, value: stats },
    reviewCount: { state: 'ready' as const, value: due.cards.length },
  };
}

async function historicalReading(userId: string, shelfEntryId: string) {
  await h.database.pg.query(
    `INSERT INTO reading_sessions (id, user_id, shelf_entry_id, started_at, ended_at, focused_seconds, start_page, end_page, local_date, xp_earned)
     VALUES ($1, $2, $3, '2026-09-27T11:00:00Z', '2026-09-27T11:10:00Z', 600, 0, 10, '2026-09-27', 10)`,
    [crypto.randomUUID(), userId, shelfEntryId],
  );
}

describe('actual mobile client → authenticated API → Today action', () => {
  it('chooses an empty shelf, starts reading and continues after a real accepted session', async () => {
    const who = await reader();
    const empty = await todayInput(who.client);
    expect(empty.reading.value.lastReadingDate).toBeNull();
    expect(selectTodayAction(empty)).toEqual({ kind: 'choose' });

    const entry = await who.client.addBook({
      title: 'Livro da próxima ação',
      totalPages: 200,
      status: 'reading',
    });
    expect(selectTodayAction(await todayInput(who.client))).toEqual({
      kind: 'read',
      shelfEntryId: entry.id,
    });

    const accepted = await who.client.recordSession({
      id: crypto.randomUUID(),
      shelfEntryId: entry.id,
      startedAt: `${TODAY}T11:00:00.000Z`,
      endedAt: `${TODAY}T11:10:00.000Z`,
      focusedSeconds: 600,
      endPage: 10,
      recall: VALID_SESSION_RECALL,
      localDate: TODAY,
    });
    expect(accepted.stats.lastReadingDate).toBe(TODAY);
    const recorded = await todayInput(who.client);
    expect(recorded.reading.value.lastReadingDate).toBe(TODAY);
    expect(selectTodayAction(recorded)).toEqual({ kind: 'continue', shelfEntryId: entry.id });
  });

  it('offers the daily review queue and returns to reading when its limit is reached', async () => {
    const who = await reader();
    const entry = await who.client.addBook({
      title: 'Livro da volta à leitura',
      totalPages: 200,
      status: 'reading',
    });
    await historicalReading(who.id, entry.id);
    expect(selectTodayAction(await todayInput(who.client))).toEqual({
      kind: 'return',
      shelfEntryId: entry.id,
      awayDays: 7,
    });

    await who.client.savePreferences({
      ...(await who.client.getPreferences()),
      dailyReviewLimit: 5,
    });
    for (let index = 0; index < 7; index += 1) {
      await who.client.createCard({
        shelfEntryId: entry.id,
        prompt: `Pergunta registrada ${index + 1}`,
        localDate: TODAY,
      });
    }
    await h.database.pg.query('UPDATE recall_cards SET due_date = $1 WHERE user_id = $2', [
      TODAY,
      who.id,
    ]);

    const offered = await who.client.getDueCards(TODAY);
    expect(offered).toMatchObject({ dueCount: 7, dailyLimit: 5, reviewedToday: 0 });
    expect(offered.cards).toHaveLength(5);
    expect(selectTodayAction(await todayInput(who.client))).toEqual({ kind: 'review', count: 5 });

    for (const card of offered.cards) {
      await who.client.reviewCard(card.id, {
        id: crypto.randomUUID(),
        grade: 4,
        localDate: TODAY,
      });
    }
    const limited = await who.client.getDueCards(TODAY);
    expect(limited).toMatchObject({ dueCount: 2, reviewedToday: 5, cards: [] });
    const afterReviews = await todayInput(who.client);
    expect(afterReviews.reading.value).toMatchObject({
      lastReadingDate: '2026-09-27',
      readToday: false,
      reviewedToday: true,
    });
    expect(selectTodayAction(afterReviews)).toEqual({
      kind: 'return',
      shelfEntryId: entry.id,
      awayDays: 7,
    });
  });

  it('accepts an older stats response without inventing how long the reader was away', async () => {
    const who = await reader();
    const entry = await who.client.addBook({
      title: 'Livro com API anterior',
      totalPages: 200,
      status: 'reading',
    });
    await historicalReading(who.id, entry.id);

    const legacyBridge: typeof fetch = async (input, init) => {
      const response = await bridge(input, init);
      if (new URL(new Request(input, init).url).pathname !== '/v1/me/stats' || !response.ok)
        return response;
      const legacy: Partial<StatsResponse> = statsResponseSchema.parse(await response.json());
      delete legacy.lastReadingDate;
      return Response.json(legacy, { status: response.status, headers: response.headers });
    };
    const legacyInput = await todayInput(clientFor(who.cookie, legacyBridge));
    expect(legacyInput.reading.value.lastReadingDate).toBeNull();
    expect(selectTodayAction(legacyInput)).toEqual({ kind: 'read', shelfEntryId: entry.id });
  });
});
