import { meResponseSchema, shelfEntrySchema, statsResponseSchema } from '@bubo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;

beforeAll(async () => {
  h = await createHarness({ now: () => new Date('2026-10-04T12:00:00Z') });
}, 60_000);
afterAll(async () => {
  await h.close();
});

async function reader() {
  const { cookie } = await h.signUp();
  const me = meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
  const entry = shelfEntrySchema.parse(
    await (
      await h.call('/v1/shelf', {
        method: 'POST',
        cookie,
        json: { title: 'Livro da recência', totalPages: 200 },
      })
    ).json(),
  );
  return { cookie, id: me.user.id, entryId: entry.id };
}

type Reader = Awaited<ReturnType<typeof reader>>;

/** Seed accepted historical sessions, including records older than the client upload window. */
async function session(who: Reader, localDate: string, endedAt = `${localDate}T12:00:00Z`) {
  await h.database.pg.query(
    `INSERT INTO reading_sessions (id, user_id, shelf_entry_id, started_at, ended_at, focused_seconds, start_page, end_page, local_date, xp_earned)
     VALUES ($1, $2, $3, $4::timestamptz - interval '10 minutes', $4::timestamptz, 600, 0, 10, $5, 10)`,
    [crypto.randomUUID(), who.id, who.entryId, endedAt, localDate],
  );
}

async function review(who: Reader, localDate: string) {
  const cardId = crypto.randomUUID();
  await h.database.pg.query(
    `INSERT INTO recall_cards (id, user_id, shelf_entry_id, prompt, source, due_date)
     VALUES ($1, $2, $3, 'Uma pergunta registrada', 'manual', $4)`,
    [cardId, who.id, who.entryId, localDate],
  );
  await h.database.pg.query(
    `INSERT INTO review_logs (id, user_id, card_id, grade, reviewed_at, local_date, interval_days, xp_earned)
     VALUES ($1, $2, $3, 4, $4::timestamptz, $5, 1, 5)`,
    [crypto.randomUUID(), who.id, cardId, `${localDate}T12:00:00Z`, localDate],
  );
}

async function stats(who: Reader, today = '2026-10-04') {
  const response = await h.call(`/v1/me/stats?today=${today}`, { cookie: who.cookie });
  expect(response.status).toBe(200);
  return statsResponseSchema.parse(await response.json());
}

describe('last reading date', () => {
  it('requires a session and isolates reading activity to the signed-in reader', async () => {
    const owner = await reader();
    const other = await reader();
    expect((await h.call('/v1/me/stats?today=2026-10-04')).status).toBe(401);
    await session(owner, '2026-10-03');
    expect((await stats(owner)).lastReadingDate).toBe('2026-10-03');
    expect((await stats(other)).lastReadingDate).toBeNull();
    await session(other, '2026-10-04');
    expect((await stats(owner)).lastReadingDate).toBe('2026-10-03');
    expect((await stats(other)).lastReadingDate).toBe('2026-10-04');
  });

  it('finds the most recent reading across all history beyond the streak window', async () => {
    const who = await reader();
    await session(who, '2023-05-01');
    await session(who, '2024-02-29');
    expect((await stats(who)).lastReadingDate).toBe('2024-02-29');
  });

  it('uses the recorded local calendar date rather than UTC timestamp order', async () => {
    const who = await reader();
    await session(who, '2026-10-02', '2026-10-03T00:20:00Z');
    await session(who, '2026-10-03', '2026-10-02T23:20:00Z');
    expect((await stats(who)).lastReadingDate).toBe('2026-10-03');
  });

  it('excludes future local dates and returns null when every session is after today', async () => {
    const who = await reader();
    await session(who, '2026-10-03');
    await session(who, '2026-10-04');
    await session(who, '2026-10-05');
    expect((await stats(who, '2026-10-02')).lastReadingDate).toBeNull();
    expect((await stats(who, '2026-10-03')).lastReadingDate).toBe('2026-10-03');
    expect((await stats(who)).lastReadingDate).toBe('2026-10-04');
  });

  it('keeps reviews as review activity without inventing a reading date', async () => {
    const who = await reader();
    await review(who, '2026-10-04');
    expect(await stats(who)).toMatchObject({
      lastReadingDate: null,
      sessionsCount: 0,
      readToday: false,
      reviewedToday: true,
    });
    await session(who, '2026-09-25');
    expect((await stats(who)).lastReadingDate).toBe('2026-09-25');
  });
});
