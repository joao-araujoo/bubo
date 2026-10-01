import { memoryStatsResponseSchema, recallCardSchema, shelfEntrySchema } from '@bubo/contracts';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
let now = new Date('2026-09-26T15:00:00Z');
beforeAll(async () => {
  h = await createHarness({ now: () => now });
}, 60_000);
afterAll(async () => {
  await h.close();
});
const path = '/v1/me/memory?today=2026-09-27';

it('requires authentication and a real calendar date', async () => {
  expect((await h.call(path)).status).toBe(401);
  const { cookie } = await h.signUp();
  expect((await h.call('/v1/me/memory?today=2026-02-30', { cookie })).status).toBe(422);
});

it('returns an honest seven-day empty history', async () => {
  const { cookie } = await h.signUp();
  const result = memoryStatsResponseSchema.parse(await (await h.call(path, { cookie })).json());
  expect(result.days.map((day) => day.date)).toEqual([
    '2026-09-21',
    '2026-09-22',
    '2026-09-23',
    '2026-09-24',
    '2026-09-25',
    '2026-09-26',
    '2026-09-27',
  ]);
  expect(result.days.every((day) => day.remembered + day.almost + day.forgot === 0)).toBe(true);
});

it('counts persisted grades once, scopes the owner and bounds the date window', async () => {
  const { cookie } = await h.signUp();
  const entry = shelfEntrySchema.parse(
    await (
      await h.call('/v1/shelf', {
        method: 'POST',
        cookie,
        json: { title: 'Livro do teste de memória' },
      })
    ).json(),
  );
  for (const grade of [1, 3, 4, 5]) {
    now = new Date('2026-09-26T15:00:00Z');
    const card = recallCardSchema.parse(
      await (
        await h.call('/v1/recall/cards', {
          method: 'POST',
          cookie,
          json: { shelfEntryId: entry.id, prompt: `Pergunta ${grade}`, localDate: '2026-09-26' },
        })
      ).json(),
    );
    now = new Date('2026-09-27T15:00:00Z');
    const json = { id: crypto.randomUUID(), grade, localDate: '2026-09-27' };
    expect(
      (await h.call(`/v1/recall/cards/${card.id}/review`, { method: 'POST', cookie, json })).status,
    ).toBe(201);
    expect(
      (await h.call(`/v1/recall/cards/${card.id}/review`, { method: 'POST', cookie, json })).status,
    ).toBe(200);
  }
  const read = async (cookie: string, url = path) =>
    memoryStatsResponseSchema.parse(await (await h.call(url, { cookie })).json());
  expect((await read(cookie)).days[6]).toEqual({
    date: '2026-09-27',
    remembered: 2,
    almost: 1,
    forgot: 1,
  });
  for (const result of [
    await read((await h.signUp()).cookie),
    await read(cookie, '/v1/me/memory?today=2026-09-26'),
    await read(cookie, '/v1/me/memory?today=2026-10-04'),
  ]) {
    expect(result.days.every((day) => day.remembered + day.almost + day.forgot === 0)).toBe(true);
  }

  // Breakdowns (ADR-020): per book, by local time of day, cards and the period length.
  const month = await read(cookie, '/v1/me/memory?today=2026-09-27&days=30&tz=-180');
  expect(month.days).toHaveLength(30);
  expect(month.days[0]?.date).toBe('2026-08-29');
  expect(month.books).toEqual([
    expect.objectContaining({ shelfEntryId: entry.id, cards: 4, total: 4, remembered: 2 }),
  ]);
  expect(month).toMatchObject({ cardsTotal: 4, booksWithCards: 1 });
  expect(month.focus).toEqual({ focusedMinutes: 0, readingDays: 0 });
  // Reviewed at 15:00 UTC: 12:00 in São Paulo (afternoon), 05:00 at UTC−10 (dawn).
  expect(month.dayParts.afternoon).toEqual({ total: 4, remembered: 2 });
  const hawaii = await read(cookie, '/v1/me/memory?today=2026-09-27&tz=-600');
  expect(hawaii.dayParts.dawn).toEqual({ total: 4, remembered: 2 });
  expect(hawaii.dayParts.afternoon).toEqual({ total: 0, remembered: 0 });
  for (const bad of ['days=14', 'tz=900', 'days=abc']) {
    expect((await h.call(`${path}&${bad}`, { cookie })).status).toBe(422);
  }
});
