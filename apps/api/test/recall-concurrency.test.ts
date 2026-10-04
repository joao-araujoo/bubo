import {
  meResponseSchema,
  recallCardSchema,
  reviewResultSchema,
  shelfEntrySchema,
} from '@bubo/contracts';
import { type QueryOptions, type Transaction } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

const now = new Date('2026-10-03T15:00:00.000Z');
let h: Awaited<ReturnType<typeof createHarness>>;

beforeAll(async () => {
  h = await createHarness({ now: () => now });
}, 60_000);
afterAll(async () => {
  await h.close();
});

async function readerWithDueCard() {
  const { cookie } = await h.signUp();
  const userId = meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json()).user.id;
  const entry = shelfEntrySchema.parse(
    await (
      await h.call('/v1/shelf', {
        method: 'POST',
        cookie,
        json: { title: 'Uma leitura para lembrar' },
      })
    ).json(),
  );
  const card = recallCardSchema.parse(
    await (
      await h.call('/v1/recall/cards', {
        method: 'POST',
        cookie,
        json: {
          shelfEntryId: entry.id,
          prompt: 'Qual ideia ficou com você?',
          localDate: '2026-10-02',
        },
      })
    ).json(),
  );
  return { cookie, userId, card };
}

function review(cookie: string, cardId: string, id: string) {
  return h.call(`/v1/recall/cards/${cardId}/review`, {
    method: 'POST',
    cookie,
    json: { id, grade: 4, localDate: '2026-10-03' },
  });
}

async function counts(cardId: string) {
  const result = await h.database.pg.query<{ reviews: number; xp: number }>(
    `SELECT count(*)::int AS reviews, coalesce(sum(xp_earned), 0)::int AS xp
     FROM review_logs WHERE card_id = $1`,
    [cardId],
  );
  return result.rows[0];
}

describe('concurrent recall reviews', () => {
  it('confirms repeated UUIDs with one schedule change and one XP award', async () => {
    const who = await readerWithDueCard();
    const id = crypto.randomUUID();
    const responses = await Promise.all([
      review(who.cookie, who.card.id, id),
      review(who.cookie, who.card.id, id),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    for (const response of responses) {
      expect(reviewResultSchema.parse(await response.json())).toMatchObject({
        card: { repetitions: 1, intervalDays: 1, dueDate: '2026-10-04' },
        xpEarned: 5,
        stats: { xpTotal: 5 },
      });
    }
    expect(await counts(who.card.id)).toEqual({ reviews: 1, xp: 5 });
  });

  it('refuses a second UUID once the same due card has been rescheduled', async () => {
    const who = await readerWithDueCard();
    const responses = await Promise.all([
      review(who.cookie, who.card.id, crypto.randomUUID()),
      review(who.cookie, who.card.id, crypto.randomUUID()),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await counts(who.card.id)).toEqual({ reviews: 1, xp: 5 });
  });

  it('recognizes a UUID committed between the first lookup and acquiring the card lock', async () => {
    const who = await readerWithDueCard();
    const id = crypto.randomUUID();
    expect((await review(who.cookie, who.card.id, id)).status).toBe(201);

    // PGlite serializes transactions. Hide only the first UUID lookup to reproduce the
    // observation of a request that started before another request committed its review.
    const originalTransaction = h.database.pg.transaction;
    const transact = originalTransaction.bind(h.database.pg);
    const observations: string[] = [];
    let staleLookup = true;
    h.database.pg.transaction = async <T>(callback: (tx: Transaction) => Promise<T>) =>
      transact<T>(async (tx) => {
        const query = tx.query.bind(tx);
        tx.query = async <Row>(sqlText: string, params?: unknown[], options?: QueryOptions) => {
          const result = await query<Row>(sqlText, params, options);
          if (sqlText.includes('from "review_logs"') && params?.[0] === id) {
            if (staleLookup) {
              staleLookup = false;
              observations.push('stale lookup');
              return { ...result, rows: [] };
            }
            observations.push('committed review lookup');
          }
          if (sqlText.includes('from "recall_cards"') && sqlText.includes('for update')) {
            expect(params).toEqual([who.card.id, who.userId]);
            observations.push('card lock');
          }
          return result;
        };
        return callback(tx);
      });
    try {
      const retry = await review(who.cookie, who.card.id, id);
      expect(retry.status).toBe(200);
      expect(reviewResultSchema.parse(await retry.json())).toMatchObject({
        card: { repetitions: 1, intervalDays: 1, dueDate: '2026-10-04' },
        xpEarned: 5,
        stats: { xpTotal: 5 },
      });
      expect(observations).toEqual(['stale lookup', 'card lock', 'committed review lookup']);
      expect(await counts(who.card.id)).toEqual({ reviews: 1, xp: 5 });
    } finally {
      h.database.pg.transaction = originalTransaction;
    }
  });
});
