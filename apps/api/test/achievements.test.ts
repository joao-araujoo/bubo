import { achievementsResponseSchema, shelfEntrySchema } from '@bubo/contracts';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
let now = new Date('2026-09-24T15:00:00.000Z');
beforeAll(async () => {
  h = await createHarness({ now: () => now });
}, 60_000);
afterAll(async () => {
  await h.close();
});

const read = async (cookie: string, today: string) =>
  achievementsResponseSchema.parse(
    await (await h.call(`/v1/me/achievements?today=${today}`, { cookie })).json(),
  );

it('requires a session and a calendar date', async () => {
  expect((await h.call('/v1/me/achievements?today=2026-09-24')).status).toBe(401);
  const { cookie } = await h.signUp();
  expect((await h.call('/v1/me/achievements?today=2026-13-01', { cookie })).status).toBe(422);
});

it('starts at level 1 with nothing unlocked', async () => {
  const { cookie } = await h.signUp();
  const result = await read(cookie, '2026-09-24');
  expect(result.level).toMatchObject({ level: 1, xpTotal: 0, nextLevelXp: 100 });
  expect(result.unlockedCount).toBe(0);
  expect(result.streakDays).toBe(0);
  expect(result.achievements.every((a) => !a.unlocked && a.progress === 0)).toBe(true);
});

it('unlocks from recorded sessions, finished books and streaks, scoped to the reader', async () => {
  const { cookie } = await h.signUp();
  const entry = shelfEntrySchema.parse(
    await (
      await h.call('/v1/shelf', {
        method: 'POST',
        cookie,
        json: { title: 'Conquistas', totalPages: 300, status: 'reading' },
      })
    ).json(),
  );
  const days = ['2026-09-24', '2026-09-25', '2026-09-26'];
  for (const [index, day] of days.entries()) {
    now = new Date(`${day}T15:00:00.000Z`);
    const json = {
      id: crypto.randomUUID(),
      shelfEntryId: entry.id,
      startedAt: `${day}T14:00:00.000Z`,
      endedAt: `${day}T14:40:00.000Z`,
      focusedSeconds: 40 * 60,
      endPage: (index + 1) * 20,
      reflection: index === 0 ? 'Uma ideia que ficou.' : null,
      localDate: day,
    };
    expect((await h.call('/v1/sessions', { method: 'POST', cookie, json })).status).toBe(201);
    // Idempotent retry must not count twice.
    expect((await h.call('/v1/sessions', { method: 'POST', cookie, json })).status).toBe(200);
  }
  expect(
    (
      await h.call(`/v1/shelf/${entry.id}`, {
        method: 'PATCH',
        cookie,
        json: { status: 'finished' },
      })
    ).status,
  ).toBe(200);

  const result = await read(cookie, '2026-09-26');
  const byId = new Map(result.achievements.map((a) => [a.id, a]));
  expect(byId.get('first_session')).toMatchObject({ unlocked: true, progress: 1 });
  expect(byId.get('ten_sessions')).toMatchObject({ unlocked: false, progress: 3 });
  expect(byId.get('ten_hours')?.progress).toBe(120);
  expect(byId.get('thousand_pages')?.progress).toBe(60);
  expect(byId.get('first_book')?.unlocked).toBe(true);
  expect(byId.get('five_reflections')?.progress).toBe(1);
  expect(byId.get('streak_3')?.unlocked).toBe(true);
  expect(result.streakDays).toBe(3);
  expect(result.longestStreakDays).toBe(3);
  expect(result.level).toMatchObject({ level: 2, xpTotal: 120 });
  expect(result.unlockedCount).toBe(3);

  // Another reader sees none of it.
  expect((await read((await h.signUp()).cookie, '2026-09-26')).unlockedCount).toBe(0);
  // A later "today" keeps the longest streak even after the current one breaks.
  const later = await read(cookie, '2026-10-10');
  expect(later.streakDays).toBe(0);
  expect(later.longestStreakDays).toBe(3);
});
