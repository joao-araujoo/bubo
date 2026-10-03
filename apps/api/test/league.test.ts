import {
  clubDetailSchema,
  leagueResponseSchema,
  meResponseSchema,
  statsResponseSchema,
} from '@bubo/contracts';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
beforeAll(async () => {
  h = await createHarness({ now: () => new Date('2026-10-15T15:00:00Z') });
}, 60000);
afterAll(async () => {
  await h.close();
});

async function reader() {
  const { cookie } = await h.signUp();
  const me = meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
  return { cookie, id: me.user.id };
}

let sequence = 0;
/** A historical session row (no recall pair), written directly like an imported record. */
async function session(userId: string, localDate: string, xp: number, startedAt?: string) {
  sequence += 1;
  await h.database.pg.query(
    `INSERT INTO shelf_entries (id, user_id, book_id) VALUES ($1, $2, 'league-book') ON CONFLICT DO NOTHING`,
    [`league-entry-${userId}`, userId],
  );
  const found = await h.database.pg.query<{ id: string }>(
    `SELECT id FROM shelf_entries WHERE user_id = $1 AND book_id = 'league-book'`,
    [userId],
  );
  const entry = found.rows[0]?.id;
  const start = startedAt ?? `${localDate}T12:00:00Z`;
  await h.database.pg.query(
    `INSERT INTO reading_sessions (id, user_id, shelf_entry_id, started_at, ended_at, focused_seconds, start_page, end_page, local_date, xp_earned)
     VALUES ($1, $2, $3, $4, $4, 600, 0, 10, $5, $6)`,
    [`league-session-${sequence}`, userId, entry, start, localDate, xp],
  );
}

const league = async (who: { cookie: string }, today: string) => {
  const response = await h.call(`/v1/me/league?today=${today}`, { cookie: who.cookie });
  expect(response.status).toBe(200);
  return leagueResponseSchema.parse(await response.json());
};

it('ranks the reader with sharing friends by real weekly XP and reports movement', async () => {
  await h.database.pg.query(
    `INSERT INTO books (id, title, total_pages, catalog_key) VALUES ('league-book', 'Liga', 200, 'ol:league')`,
  );
  const me = await reader();
  const friend = await reader();
  const quiet = await reader();
  expect((await h.call('/v1/me/league?today=2026-10-15')).status).toBe(401);
  expect((await h.call('/v1/me/league?today=ontem', { cookie: me.cookie })).status).toBe(422);

  // Alone: an honest league of one.
  const solo = await league(me, '2026-10-15');
  expect(solo).toMatchObject({
    weekStart: '2026-10-12',
    weekEnd: '2026-10-18',
    daysLeft: 4,
    sharing: false,
    me: { rank: 1, previousRank: 1, weeklyXp: 0 },
  });
  expect(solo.entries).toHaveLength(1);

  // Friendship needs a shared club; `quiet` is a friend who does not share activity.
  await h.database.pg.query(
    `INSERT INTO shelf_entries (id, user_id, book_id) VALUES ('league-club-entry', $1, 'league-book')`,
    [me.id],
  );
  const club = clubDetailSchema.parse(
    await (
      await h.call('/v1/clubs', {
        method: 'POST',
        cookie: me.cookie,
        json: { name: 'Liga dos leitores', icon: 'mind', shelfEntryId: 'league-club-entry' },
      })
    ).json(),
  );
  for (const other of [friend, quiet]) {
    await h.call(`/v1/clubs/${club.id}/membership`, {
      method: 'PUT',
      cookie: other.cookie,
      json: { acceptGuidelines: true },
    });
    await h.call(`/v1/community/friends/${other.id}`, {
      method: 'PUT',
      cookie: me.cookie,
      json: { action: 'request' },
    });
    await h.call(`/v1/community/friends/${me.id}`, {
      method: 'PUT',
      cookie: other.cookie,
      json: { action: 'accept' },
    });
  }
  await h.call('/v1/me/social-preferences', {
    method: 'PUT',
    cookie: friend.cookie,
    json: { shareActivity: true, allowRequests: true },
  });
  // Pretend the friendship and sharing began on Oct 1 so this week's sessions are shared.
  await h.database.pg.query(
    `UPDATE reading_club_social_preferences SET sharing_since = '2026-10-01T00:00:00Z' WHERE user_id = $1`,
    [friend.id],
  );
  await h.database.pg.query(
    `UPDATE reading_club_friendships SET accepted_at = '2026-10-01T00:00:00Z' WHERE accepted_at IS NOT NULL`,
  );

  await session(me.id, '2026-10-13', 20);
  await session(me.id, '2026-10-15', 40);
  await session(me.id, '2026-10-05', 500); // last week: never counts
  // Before sharing started: not counted. After: counted.
  await session(friend.id, '2026-10-12', 900, '2020-01-01T00:00:00Z');
  await session(friend.id, '2026-10-14', 30);
  await session(quiet.id, '2026-10-14', 999);

  const standings = await league(me, '2026-10-15');
  expect(standings.entries.map((entry) => [entry.rank, entry.weeklyXp, entry.me])).toEqual([
    [1, 60, true],
    [2, 30, false],
  ]);
  // Yesterday: friend 30 > me 20, so the reader moved up one position today.
  expect(standings.me).toEqual({ rank: 1, previousRank: 2, weeklyXp: 60 });
  expect(JSON.stringify(standings)).not.toContain(friend.id);
  expect(JSON.stringify(standings)).not.toContain('999');

  // The friend sees the reader only once the reader shares too.
  expect((await league(friend, '2026-10-15')).entries).toHaveLength(1);
  // Monday: no movement yet.
  expect((await league(me, '2026-10-12')).me.previousRank).toBeNull();
});

it('keeps the streak through a day covered by an earned protection', async () => {
  const me = await reader();
  for (let day = 3; day <= 9; day += 1) await session(me.id, `2026-10-0${day}`, 10);
  // 10-10 missed: covered. 10-11 read again.
  await session(me.id, '2026-10-11', 10);
  const stats = statsResponseSchema.parse(
    await (await h.call('/v1/me/stats?today=2026-10-11', { cookie: me.cookie })).json(),
  );
  expect(stats.streakDays).toBe(8);
  expect(stats.streakFreeze).toEqual({
    available: 0,
    max: 2,
    earnEvery: 7,
    progress: 1,
    frozenDates: ['2026-10-10'],
  });
  const fresh = await reader();
  const empty = statsResponseSchema.parse(
    await (await h.call('/v1/me/stats?today=2026-10-11', { cookie: fresh.cookie })).json(),
  );
  expect(empty.streakFreeze).toMatchObject({ available: 0, frozenDates: [] });
});
