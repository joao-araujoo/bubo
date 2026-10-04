import { memoryStatsResponseSchema, recallCardSchema, shelfEntrySchema } from '@bubo/contracts';
import { DELAYED_RECALL_WINDOWS } from '@bubo/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
let now = new Date('2026-10-03T12:00:00Z');
beforeAll(async () => {
  h = await createHarness({ now: () => now });
}, 60_000);
afterAll(async () => {
  await h.close();
});

async function reader() {
  const { cookie } = await h.signUp();
  const entry = shelfEntrySchema.parse(
    await (
      await h.call('/v1/shelf', {
        method: 'POST',
        cookie,
        json: { title: 'Memória ao longo do tempo' },
      })
    ).json(),
  );
  const { rows } = await h.database.pg.query<{ user_id: string }>(
    'select user_id from shelf_entries where id = $1',
    [entry.id],
  );
  const userId = rows[0]?.user_id;
  if (!userId) throw new Error('Reader fixture has no owner.');
  return { cookie, entry, userId };
}

type Reader = Awaited<ReturnType<typeof reader>>;

async function card(owner: Reader, createdAt: Date) {
  now = createdAt;
  const result = recallCardSchema.parse(
    await (
      await h.call('/v1/recall/cards', {
        method: 'POST',
        cookie: owner.cookie,
        json: {
          shelfEntryId: owner.entry.id,
          prompt: 'Qual ideia você lembra?',
          localDate: createdAt.toISOString().slice(0, 10),
        },
      })
    ).json(),
  );
  // Card creation uses the database clock; pin the first anchor independently of the host clock.
  await h.database.pg.query('update recall_cards set created_at = $1 where id = $2', [
    createdAt.toISOString(),
    result.id,
  ]);
  return result;
}

async function seedReview(
  owner: Reader,
  cardId: string,
  reviewedAt: string,
  grade = 4,
  options: { localDate?: string; intervalDays?: number; userId?: string } = {},
) {
  await h.database.pg.query(
    'insert into review_logs (id, user_id, card_id, grade, reviewed_at, local_date, interval_days) values ($1, $2, $3, $4, $5, $6, $7)',
    [
      crypto.randomUUID(),
      options.userId ?? owner.userId,
      cardId,
      grade,
      reviewedAt,
      options.localDate ?? reviewedAt.slice(0, 10),
      options.intervalDays ?? 1,
    ],
  );
}

async function memory(owner: Reader, today = '2026-10-03') {
  const response = await h.call(`/v1/me/memory?today=${today}`, { cookie: owner.cookie });
  expect(response.status).toBe(200);
  return memoryStatsResponseSchema.parse(await response.json());
}

function windows(short: [number, number], medium: [number, number], long: [number, number]) {
  return DELAYED_RECALL_WINDOWS.map((window, index) => {
    const counts = [short, medium, long][index];
    if (!counts) throw new Error('Missing delay fixture.');
    return { window, total: counts[0], remembered: counts[1] };
  });
}

describe('observed delayed recall', () => {
  it('returns three honest empty windows with a version', async () => {
    const owner = await reader();
    expect((await memory(owner)).delayedRecall).toEqual({
      version: 'observed-v1',
      windows: windows([0, 0], [0, 0], [0, 0]),
    });
  });

  it('keeps earlier history as the anchor and counts only reviews in the displayed period', async () => {
    const owner = await reader();
    const item = await card(owner, new Date('2026-08-01T12:00:00Z'));
    await seedReview(owner, item.id, '2026-08-02T12:00:00Z', 5);
    await seedReview(owner, item.id, '2026-09-25T12:00:00Z', 1);
    await seedReview(owner, item.id, '2026-10-01T12:00:00Z', 4);
    await seedReview(owner, item.id, '2026-10-10T12:00:00Z', 5);
    expect((await memory(owner)).delayedRecall.windows).toEqual(windows([1, 1], [0, 0], [0, 0]));
  });

  it('keeps an attempt under 24 hours as the next delay anchor without counting it as an observation', async () => {
    const owner = await reader();
    const item = await card(owner, new Date('2026-09-10T12:00:00Z'));
    await seedReview(owner, item.id, '2026-09-27T12:00:00Z', 1);
    await seedReview(owner, item.id, '2026-09-28T00:00:00Z', 5);
    await seedReview(owner, item.id, '2026-10-04T18:00:00Z', 4);
    expect((await memory(owner, '2026-10-04')).delayedRecall.windows).toEqual(
      windows([1, 1], [0, 0], [0, 0]),
    );
  });

  it('uses the exact 24-hour, seven-day and thirty-day boundaries and excludes earlier attempts', async () => {
    const owner = await reader();
    const reviewedAt = new Date('2026-10-03T12:00:00Z');
    const cases = [
      { seconds: -1, grade: 5 },
      { seconds: 0, grade: 5 },
      { seconds: 86_399, grade: 5 },
      { seconds: 86_400, grade: 4 },
      { seconds: 604_799, grade: 3 },
      { seconds: 604_800, grade: 5 },
      { seconds: 2_591_999, grade: 2 },
      { seconds: 2_592_000, grade: 0 },
      { seconds: 5_184_000, grade: 4 },
    ];
    for (const attempt of cases) {
      const item = await card(owner, new Date(reviewedAt.getTime() - attempt.seconds * 1_000));
      await seedReview(owner, item.id, reviewedAt.toISOString(), attempt.grade);
    }
    expect((await memory(owner)).delayedRecall.windows).toEqual(windows([2, 1], [2, 1], [2, 1]));
  });

  it('measures elapsed timestamps instead of a local calendar day change', async () => {
    const owner = await reader();
    const midnight = await card(owner, new Date('2026-10-02T23:30:00Z'));
    await seedReview(owner, midnight.id, '2026-10-03T00:30:00Z', 5);
    const fullDay = await card(owner, new Date('2026-10-02T00:00:00Z'));
    await seedReview(owner, fullDay.id, '2026-10-03T00:00:00Z', 4, { localDate: '2026-10-02' });
    expect((await memory(owner)).delayedRecall.windows).toEqual(windows([1, 1], [0, 0], [0, 0]));
    expect((await memory(owner)).days.find((day) => day.date === '2026-10-02')?.remembered).toBe(1);
  });

  it('ignores the SM-2 scheduled interval on both cards and reviews', async () => {
    const owner = await reader();
    const longDelay = await card(owner, new Date('2026-09-03T12:00:00Z'));
    const shortDelay = await card(owner, new Date('2026-10-02T12:00:00Z'));
    await h.database.pg.query('update recall_cards set interval_days = 365 where id = $1', [
      shortDelay.id,
    ]);
    await seedReview(owner, longDelay.id, '2026-10-03T12:00:00Z', 4, { intervalDays: 1 });
    await seedReview(owner, shortDelay.id, '2026-10-03T12:00:00Z', 5, { intervalDays: 365 });
    expect((await memory(owner)).delayedRecall.windows).toEqual(windows([1, 1], [0, 0], [1, 1]));
  });

  it('counts all six grades as attempts and only grades four and five as remembered', async () => {
    const owner = await reader();
    for (const grade of [0, 1, 2, 3, 4, 5]) {
      const item = await card(owner, new Date('2026-10-02T12:00:00Z'));
      await seedReview(owner, item.id, '2026-10-03T12:00:00Z', grade);
    }
    expect((await memory(owner)).delayedRecall.windows).toEqual(windows([6, 2], [0, 0], [0, 0]));
  });

  it('scopes reviews and their cards to the authenticated reader', async () => {
    const owner = await reader();
    const other = await reader();
    const owned = await card(owner, new Date('2026-10-02T12:00:00Z'));
    const foreign = await card(other, new Date('2026-09-03T12:00:00Z'));
    await seedReview(owner, owned.id, '2026-10-03T12:00:00Z', 4);
    await seedReview(other, foreign.id, '2026-10-03T12:00:00Z', 1);
    // Even inconsistent legacy ownership must not let a review cross its card owner's boundary.
    await seedReview(owner, foreign.id, '2026-10-03T13:00:00Z', 5);
    await seedReview(owner, owned.id, '2026-10-03T13:00:00Z', 5, { userId: other.userId });
    expect((await memory(owner)).delayedRecall.windows).toEqual(windows([1, 1], [0, 0], [0, 0]));
    expect((await memory(other)).delayedRecall.windows).toEqual(windows([0, 0], [0, 0], [1, 0]));
  });

  it('does not double count retries and removes observations when their card is deleted', async () => {
    const owner = await reader();
    const item = await card(owner, new Date('2026-10-02T12:00:00Z'));
    now = new Date('2026-10-03T12:00:00Z');
    const json = { id: crypto.randomUUID(), grade: 4, localDate: '2026-10-03' };
    const review = () =>
      h.call(`/v1/recall/cards/${item.id}/review`, {
        method: 'POST',
        cookie: owner.cookie,
        json,
      });
    expect((await review()).status).toBe(201);
    expect((await review()).status).toBe(200);
    expect((await memory(owner)).delayedRecall.windows).toEqual(windows([1, 1], [0, 0], [0, 0]));
    expect(
      (await h.call(`/v1/recall/cards/${item.id}`, { method: 'DELETE', cookie: owner.cookie }))
        .status,
    ).toBe(200);
    const result = await memory(owner);
    expect(result.delayedRecall.windows).toEqual(windows([0, 0], [0, 0], [0, 0]));
    expect(result.cardsTotal).toBe(0);
  });
});
