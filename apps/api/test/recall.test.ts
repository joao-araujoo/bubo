import {
  dueCardsResponseSchema,
  errorResponseSchema,
  recallCardSchema,
  reviewResultSchema,
  shelfEntryDetailSchema,
  shelfEntrySchema,
} from '@bubo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness } from './harness';
import { VALID_SESSION_RECALL } from './session-fixtures';
import { reflectionFromRecall } from '@bubo/scoring';

// "Server now" can be moved forward to simulate the next days.
let now = new Date('2026-09-26T15:00:00.000Z');
let h: Awaited<ReturnType<typeof createHarness>>;

beforeAll(async () => {
  h = await createHarness({ now: () => now });
}, 60_000);
afterAll(async () => {
  await h.close();
});

let counter = 0;
const uuid = () => {
  counter += 1;
  return `10000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
};

async function readerWithBook() {
  const { cookie } = await h.signUp();
  const entry = shelfEntrySchema.parse(
    await (
      await h.call('/v1/shelf', {
        method: 'POST',
        cookie,
        json: { title: 'O Estrangeiro', totalPages: 128 },
      })
    ).json(),
  );
  return { cookie, entry };
}

async function recordSessionWithReflection(
  cookie: string,
  entryId: string,
  reflection: string | null,
) {
  return h.call('/v1/sessions', {
    method: 'POST',
    cookie,
    json: {
      id: uuid(),
      shelfEntryId: entryId,
      startedAt: '2026-09-26T14:00:00.000Z',
      endedAt: '2026-09-26T14:30:00.000Z',
      focusedSeconds: 20 * 60,
      endPage: 30,
      reflection,
      ...(reflection ? { recall: { ...VALID_SESSION_RECALL, idea: reflection } } : {}),
      localDate: '2026-09-26',
    },
  });
}

const due = async (cookie: string, today: string) =>
  dueCardsResponseSchema.parse(
    await (await h.call(`/v1/recall/due?today=${today}`, { cookie })).json(),
  );

describe('recall cards', () => {
  it('turns a session reflection into a card due tomorrow', async () => {
    now = new Date('2026-09-26T15:00:00.000Z');
    const { cookie, entry } = await readerWithBook();
    await recordSessionWithReflection(
      cookie,
      entry.id,
      'Meursault vive o absurdo sem se justificar.',
    );
    expect((await recordSessionWithReflection(cookie, entry.id, null)).status).toBe(422);

    const today = await due(cookie, '2026-09-26');
    expect(today).toMatchObject({
      dueCount: 0,
      totalCards: 1,
      nextDueDate: '2026-09-27',
      cards: [],
    });

    const tomorrow = await due(cookie, '2026-09-27');
    expect(tomorrow.dueCount).toBe(1);
    expect(tomorrow.cards[0]).toMatchObject({
      source: 'reflection',
      bookTitle: 'O Estrangeiro',
      answer: reflectionFromRecall({
        ...VALID_SESSION_RECALL,
        idea: 'Meursault vive o absurdo sem se justificar.',
      }),
    });
    expect(tomorrow.cards[0]?.prompt).toContain('O Estrangeiro');

    const detail = shelfEntryDetailSchema.parse(
      await (await h.call(`/v1/shelf/${entry.id}`, { cookie })).json(),
    );
    expect(detail.cards).toHaveLength(1);
  });

  it('creates manual cards and validates them', async () => {
    const { cookie, entry } = await readerWithBook();
    const created = await h.call('/v1/recall/cards', {
      method: 'POST',
      cookie,
      json: {
        shelfEntryId: entry.id,
        prompt: 'Por que o título é “O Estrangeiro”?',
        answer: null,
        localDate: '2026-09-26',
      },
    });
    expect(created.status).toBe(201);
    expect(recallCardSchema.parse(await created.json())).toMatchObject({
      source: 'manual',
      dueDate: '2026-09-27',
    });

    const empty = await h.call('/v1/recall/cards', {
      method: 'POST',
      cookie,
      json: { shelfEntryId: entry.id, prompt: '  ', localDate: '2026-09-26' },
    });
    expect(empty.status).toBe(422);
    const backdated = await h.call('/v1/recall/cards', {
      method: 'POST',
      cookie,
      json: { shelfEntryId: entry.id, prompt: 'X?', localDate: '2026-09-01' },
    });
    expect(backdated.status).toBe(422);
  });

  it("never exposes or reviews another reader's cards", async () => {
    const owner = await readerWithBook();
    const intruder = await h.signUp();
    const card = recallCardSchema.parse(
      await (
        await h.call('/v1/recall/cards', {
          method: 'POST',
          cookie: owner.cookie,
          json: { shelfEntryId: owner.entry.id, prompt: 'Privado?', localDate: '2026-09-26' },
        })
      ).json(),
    );
    const onForeignShelf = await h.call('/v1/recall/cards', {
      method: 'POST',
      cookie: intruder.cookie,
      json: { shelfEntryId: owner.entry.id, prompt: 'Invasão?', localDate: '2026-09-26' },
    });
    expect(onForeignShelf.status).toBe(404);
    now = new Date('2026-09-27T15:00:00.000Z');
    const review = await h.call(`/v1/recall/cards/${card.id}/review`, {
      method: 'POST',
      cookie: intruder.cookie,
      json: { id: uuid(), grade: 5, localDate: '2026-09-27' },
    });
    expect(review.status).toBe(404);
    expect(
      (await h.call(`/v1/recall/cards/${card.id}`, { method: 'DELETE', cookie: intruder.cookie }))
        .status,
    ).toBe(404);
    expect((await due(intruder.cookie, '2026-09-27')).totalCards).toBe(0);
    now = new Date('2026-09-26T15:00:00.000Z');
  });
});

describe('spaced review (SM-2)', () => {
  it('reschedules with growing intervals, resets on a miss and awards XP', async () => {
    now = new Date('2026-09-26T15:00:00.000Z');
    const { cookie, entry } = await readerWithBook();
    const card = recallCardSchema.parse(
      await (
        await h.call('/v1/recall/cards', {
          method: 'POST',
          cookie,
          json: {
            shelfEntryId: entry.id,
            prompt: 'Tese central?',
            answer: 'O absurdo.',
            localDate: '2026-09-26',
          },
        })
      ).json(),
    );

    const notDue = await h.call(`/v1/recall/cards/${card.id}/review`, {
      method: 'POST',
      cookie,
      json: { id: uuid(), grade: 4, localDate: '2026-09-26' },
    });
    expect(notDue.status).toBe(409);
    expect(errorResponseSchema.parse(await notDue.json()).error.code).toBe('CONFLICT');

    now = new Date('2026-09-27T15:00:00.000Z');
    const firstId = uuid();
    const first = await h.call(`/v1/recall/cards/${card.id}/review`, {
      method: 'POST',
      cookie,
      json: { id: firstId, grade: 4, localDate: '2026-09-27' },
    });
    expect(first.status).toBe(201);
    const r1 = reviewResultSchema.parse(await first.json());
    expect(r1.card).toMatchObject({ repetitions: 1, intervalDays: 1, dueDate: '2026-09-28' });
    expect(r1.xpEarned).toBe(5);
    expect(r1.stats).toMatchObject({
      reviewedToday: true,
      xpTotal: 5,
      weekActiveDates: ['2026-09-27'],
      weekReadingDates: [],
    });

    // Retrying the same review id is a no-op.
    const retry = await h.call(`/v1/recall/cards/${card.id}/review`, {
      method: 'POST',
      cookie,
      json: { id: firstId, grade: 4, localDate: '2026-09-27' },
    });
    expect(retry.status).toBe(200);
    expect(reviewResultSchema.parse(await retry.json()).stats.xpTotal).toBe(5);

    now = new Date('2026-09-28T15:00:00.000Z');
    const r2 = reviewResultSchema.parse(
      await (
        await h.call(`/v1/recall/cards/${card.id}/review`, {
          method: 'POST',
          cookie,
          json: { id: uuid(), grade: 5, localDate: '2026-09-28' },
        })
      ).json(),
    );
    expect(r2.card).toMatchObject({ repetitions: 2, intervalDays: 6, dueDate: '2026-10-04' });
    expect(r2.stats.streakDays).toBe(2);

    now = new Date('2026-10-04T15:00:00.000Z');
    const r3 = reviewResultSchema.parse(
      await (
        await h.call(`/v1/recall/cards/${card.id}/review`, {
          method: 'POST',
          cookie,
          json: { id: uuid(), grade: 1, localDate: '2026-10-04' },
        })
      ).json(),
    );
    expect(r3.card).toMatchObject({ repetitions: 0, intervalDays: 1, dueDate: '2026-10-05' });
    expect(r3.xpEarned).toBe(2);
    now = new Date('2026-09-26T15:00:00.000Z');
  });

  it('rejects invalid grades and implausible dates', async () => {
    const { cookie, entry } = await readerWithBook();
    const card = recallCardSchema.parse(
      await (
        await h.call('/v1/recall/cards', {
          method: 'POST',
          cookie,
          json: { shelfEntryId: entry.id, prompt: 'Q?', localDate: '2026-09-26' },
        })
      ).json(),
    );
    const bad = await h.call(`/v1/recall/cards/${card.id}/review`, {
      method: 'POST',
      cookie,
      json: { id: uuid(), grade: 7, localDate: '2026-09-27' },
    });
    expect(bad.status).toBe(422);
    const future = await h.call(`/v1/recall/cards/${card.id}/review`, {
      method: 'POST',
      cookie,
      json: { id: uuid(), grade: 4, localDate: '2026-12-01' },
    });
    expect(future.status).toBe(422);
  });

  it('deletes a card', async () => {
    const { cookie, entry } = await readerWithBook();
    const card = recallCardSchema.parse(
      await (
        await h.call('/v1/recall/cards', {
          method: 'POST',
          cookie,
          json: { shelfEntryId: entry.id, prompt: 'Apagar?', localDate: '2026-09-26' },
        })
      ).json(),
    );
    expect(
      await (await h.call(`/v1/recall/cards/${card.id}`, { method: 'DELETE', cookie })).json(),
    ).toEqual({
      deleted: true,
    });
    expect((await due(cookie, '2026-09-30')).totalCards).toBe(0);
  });
});

describe('account deletion', () => {
  it('requires the password and erases every row owned by the reader', async () => {
    const { cookie, entry } = await readerWithBook();
    expect(
      (await recordSessionWithReflection(cookie, entry.id, 'Uma ideia importante para lembrar.'))
        .status,
    ).toBe(201);

    const wrong = await h.call('/v1/auth/delete-user', {
      method: 'POST',
      cookie,
      json: { password: 'errada-000000' },
    });
    expect(wrong.status).toBeGreaterThanOrEqual(400);

    const ok = await h.call('/v1/auth/delete-user', {
      method: 'POST',
      cookie,
      json: { password: 'senha-forte-123' },
    });
    expect(ok.status).toBe(200);
    expect((await h.call('/v1/me', { cookie })).status).toBe(401);

    const { rows } = await h.database.pg.query<{ n: number }>(
      `SELECT (SELECT count(*) FROM "shelf_entries" WHERE "id" = $1)
            + (SELECT count(*) FROM "books" WHERE "id" = $2)
            + (SELECT count(*) FROM "reading_sessions" WHERE "shelf_entry_id" = $1)
            + (SELECT count(*) FROM "recall_cards" WHERE "shelf_entry_id" = $1) AS n`,
      [entry.id, entry.book.id],
    );
    expect(Number(rows[0]?.n)).toBe(0);
  });
});

describe('book memory path data', () => {
  it("lists a book's reviews once, newest first, scoped to that book and reader", async () => {
    now = new Date('2026-09-26T15:00:00.000Z');
    const { cookie, entry } = await readerWithBook();
    const other = shelfEntrySchema.parse(
      await (
        await h.call('/v1/shelf', { method: 'POST', cookie, json: { title: 'Outro livro' } })
      ).json(),
    );
    const createCard = async (shelfEntryId: string, prompt: string) =>
      recallCardSchema.parse(
        await (
          await h.call('/v1/recall/cards', {
            method: 'POST',
            cookie,
            json: { shelfEntryId, prompt, localDate: '2026-09-26' },
          })
        ).json(),
      );
    const first = await createCard(entry.id, 'Primeira ideia');
    const second = await createCard(entry.id, 'Segunda ideia');
    const elsewhere = await createCard(other.id, 'Ideia de outro livro');
    const detail = async (id: string, reader = cookie) =>
      shelfEntryDetailSchema.parse(
        await (await h.call(`/v1/shelf/${id}`, { cookie: reader })).json(),
      );
    expect((await detail(entry.id)).reviews).toEqual([]);

    const review = async (cardId: string, grade: number, id = uuid()) =>
      h.call(`/v1/recall/cards/${cardId}/review`, {
        method: 'POST',
        cookie,
        json: { id, grade, localDate: '2026-09-27' },
      });
    now = new Date('2026-09-27T10:00:00.000Z');
    const retryId = uuid();
    expect((await review(first.id, 4, retryId)).status).toBe(201);
    expect((await review(first.id, 4, retryId)).status).toBe(200);
    now = new Date('2026-09-27T11:00:00.000Z');
    expect((await review(second.id, 1)).status).toBe(201);
    expect((await review(elsewhere.id, 3)).status).toBe(201);

    const { reviews } = await detail(entry.id);
    expect(reviews.map(({ cardId, grade, localDate }) => ({ cardId, grade, localDate }))).toEqual([
      { cardId: second.id, grade: 1, localDate: '2026-09-27' },
      { cardId: first.id, grade: 4, localDate: '2026-09-27' },
    ]);
    expect(reviews[0]?.reviewedAt).toBe('2026-09-27T11:00:00.000Z');
    expect((await detail(other.id)).reviews.map((r) => r.cardId)).toEqual([elsewhere.id]);

    const stranger = await h.signUp();
    expect((await h.call(`/v1/shelf/${entry.id}`, { cookie: stranger.cookie })).status).toBe(404);
  });
});
