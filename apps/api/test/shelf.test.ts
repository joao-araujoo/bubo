import {
  errorResponseSchema,
  sessionResultSchema,
  shelfEntryDetailSchema,
  shelfEntrySchema,
  shelfResponseSchema,
  statsResponseSchema,
} from '@bubo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

// Fixed "server now" so session plausibility and streak dates are deterministic.
const NOW = new Date('2026-09-26T15:00:00.000Z');
let h: Awaited<ReturnType<typeof createHarness>>;

beforeAll(async () => {
  h = await createHarness({ now: () => NOW });
}, 60_000);
afterAll(async () => {
  await h.close();
});

async function addBook(cookie: string, json: Record<string, unknown>) {
  const response = await h.call('/v1/shelf', { method: 'POST', cookie, json });
  return { response, body: await response.json() };
}

let sessionCounter = 0;
function sessionId() {
  sessionCounter += 1;
  return `00000000-0000-4000-8000-${String(sessionCounter).padStart(12, '0')}`;
}

function sessionBody(shelfEntryId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: sessionId(),
    shelfEntryId,
    startedAt: '2026-09-26T14:00:00.000Z',
    endedAt: '2026-09-26T14:30:00.000Z',
    focusedSeconds: 25 * 60,
    endPage: 40,
    reflection: 'A ideia central ficou clara.',
    localDate: '2026-09-26',
    ...overrides,
  };
}

describe('shelf CRUD', () => {
  it('adds a book, lists it and rejects duplicates (case-insensitive)', async () => {
    const { cookie } = await h.signUp();
    const { response, body } = await addBook(cookie, {
      title: 'Duna',
      author: 'Frank Herbert',
      totalPages: 680,
    });
    expect(response.status).toBe(201);
    const entry = shelfEntrySchema.parse(body);
    expect(entry).toMatchObject({ status: 'want_to_read', currentPage: 0, startedAt: null });

    const duplicate = await addBook(cookie, { title: 'duna' });
    expect(duplicate.response.status).toBe(409);
    expect(errorResponseSchema.parse(duplicate.body).error.code).toBe('CONFLICT');

    const list = shelfResponseSchema.parse(await (await h.call('/v1/shelf', { cookie })).json());
    expect(list.entries.map((e) => e.book.title)).toEqual(['Duna']);
  });

  it('validates new books', async () => {
    const { cookie } = await h.signUp();
    const { response } = await addBook(cookie, { title: '  ', totalPages: 0 });
    expect(response.status).toBe(422);
  });

  it('starts reading immediately when added as "lendo"', async () => {
    const { cookie } = await h.signUp();
    const { body } = await addBook(cookie, { title: 'O Estrangeiro', status: 'reading' });
    expect(shelfEntrySchema.parse(body).startedAt).not.toBeNull();
  });

  it('updates status and progress with consistent timestamps', async () => {
    const { cookie } = await h.signUp();
    const entry = shelfEntrySchema.parse(
      (await addBook(cookie, { title: 'Meditações', totalPages: 200 })).body,
    );
    const path = `/v1/shelf/${entry.id}`;

    const reading = shelfEntrySchema.parse(
      await (
        await h.call(path, {
          method: 'PATCH',
          cookie,
          json: { status: 'reading', currentPage: 50 },
        })
      ).json(),
    );
    expect(reading).toMatchObject({ status: 'reading', currentPage: 50 });
    expect(reading.startedAt).not.toBeNull();

    const beyond = await h.call(path, { method: 'PATCH', cookie, json: { currentPage: 250 } });
    expect(beyond.status).toBe(422);

    const finished = shelfEntrySchema.parse(
      await (await h.call(path, { method: 'PATCH', cookie, json: { status: 'finished' } })).json(),
    );
    expect(finished).toMatchObject({ status: 'finished', currentPage: 200 });
    expect(finished.finishedAt).not.toBeNull();

    const pages = shelfEntrySchema.parse(
      await (await h.call(path, { method: 'PATCH', cookie, json: { totalPages: 320 } })).json(),
    );
    expect(pages.book.totalPages).toBe(320);

    expect((await h.call(path, { method: 'PATCH', cookie, json: {} })).status).toBe(422);
  });

  it('removes a book and its sessions', async () => {
    const { cookie } = await h.signUp();
    const entry = shelfEntrySchema.parse(
      (await addBook(cookie, { title: 'Sapiens', totalPages: 400 })).body,
    );
    await h.call('/v1/sessions', { method: 'POST', cookie, json: sessionBody(entry.id) });
    const removed = await h.call(`/v1/shelf/${entry.id}`, { method: 'DELETE', cookie });
    expect(await removed.json()).toEqual({ deleted: true });
    expect((await h.call(`/v1/shelf/${entry.id}`, { cookie })).status).toBe(404);
    const { rows } = await h.database.pg.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "reading_sessions" WHERE "shelf_entry_id" = $1`,
      [entry.id],
    );
    expect(rows[0]?.n).toBe(0);
  });

  it("never exposes or changes another reader's books", async () => {
    const owner = await h.signUp();
    const intruder = await h.signUp();
    const entry = shelfEntrySchema.parse((await addBook(owner.cookie, { title: 'Privado' })).body);
    const path = `/v1/shelf/${entry.id}`;
    expect((await h.call(path, { cookie: intruder.cookie })).status).toBe(404);
    expect(
      (await h.call(path, { method: 'PATCH', cookie: intruder.cookie, json: { currentPage: 1 } }))
        .status,
    ).toBe(404);
    expect((await h.call(path, { method: 'DELETE', cookie: intruder.cookie })).status).toBe(404);
    expect(
      (
        await h.call('/v1/sessions', {
          method: 'POST',
          cookie: intruder.cookie,
          json: sessionBody(entry.id),
        })
      ).status,
    ).toBe(404);
    expect((await h.call(path, { cookie: owner.cookie })).status).toBe(200);
  });
});

describe('reading sessions', () => {
  it('records a session: progress, status, XP and streak', async () => {
    const { cookie } = await h.signUp();
    const entry = shelfEntrySchema.parse(
      (await addBook(cookie, { title: 'Duna', totalPages: 680 })).body,
    );
    const response = await h.call('/v1/sessions', {
      method: 'POST',
      cookie,
      json: sessionBody(entry.id),
    });
    expect(response.status).toBe(201);
    const result = sessionResultSchema.parse(await response.json());
    expect(result.session).toMatchObject({
      startPage: 0,
      endPage: 40,
      pagesRead: 40,
      focusedSeconds: 1500,
    });
    expect(result.xpEarned).toBe(25);
    expect(result.entry).toMatchObject({ status: 'reading', currentPage: 40 });
    expect(result.stats).toMatchObject({
      xpTotal: 25,
      streakDays: 1,
      sessionsCount: 1,
      readToday: true,
    });

    const detail = shelfEntryDetailSchema.parse(
      await (await h.call(`/v1/shelf/${entry.id}`, { cookie })).json(),
    );
    expect(detail.sessions).toHaveLength(1);
    expect(detail.sessions[0]?.reflection).toBe('A ideia central ficou clara.');
  });

  it('is idempotent on the client session id', async () => {
    const { cookie } = await h.signUp();
    const entry = shelfEntrySchema.parse(
      (await addBook(cookie, { title: 'Idempotente', totalPages: 100 })).body,
    );
    const body = sessionBody(entry.id, { endPage: 10 });
    expect((await h.call('/v1/sessions', { method: 'POST', cookie, json: body })).status).toBe(201);
    const retry = await h.call('/v1/sessions', { method: 'POST', cookie, json: body });
    expect(retry.status).toBe(200);
    expect(sessionResultSchema.parse(await retry.json()).stats).toMatchObject({
      xpTotal: 25,
      sessionsCount: 1,
    });
  });

  it('caps XP per session and finishes the book on the last page', async () => {
    const { cookie } = await h.signUp();
    const entry = shelfEntrySchema.parse(
      (await addBook(cookie, { title: 'Curto', totalPages: 50 })).body,
    );
    const result = sessionResultSchema.parse(
      await (
        await h.call('/v1/sessions', {
          method: 'POST',
          cookie,
          json: sessionBody(entry.id, {
            startedAt: '2026-09-26T12:00:00.000Z',
            endedAt: '2026-09-26T14:00:00.000Z',
            focusedSeconds: 7200,
            endPage: 50,
          }),
        })
      ).json(),
    );
    expect(result.xpEarned).toBe(60);
    expect(result.entry).toMatchObject({ status: 'finished', currentPage: 50 });
  });

  it('rejects implausible sessions', async () => {
    const { cookie } = await h.signUp();
    const entry = shelfEntrySchema.parse(
      (await addBook(cookie, { title: 'Regras', totalPages: 100 })).body,
    );
    await h.call('/v1/sessions', {
      method: 'POST',
      cookie,
      json: sessionBody(entry.id, { endPage: 30 }),
    });
    const cases: Record<string, unknown>[] = [
      { endPage: 20 },
      { endPage: 101 },
      { startedAt: '2026-09-26T16:00:00.000Z', endedAt: '2026-09-26T16:30:00.000Z' },
      { localDate: '2026-09-20' },
      {
        startedAt: '2026-09-20T10:00:00.000Z',
        endedAt: '2026-09-20T10:30:00.000Z',
        localDate: '2026-09-20',
      },
      { focusedSeconds: 30 },
    ];
    for (const overrides of cases) {
      const response = await h.call('/v1/sessions', {
        method: 'POST',
        cookie,
        json: sessionBody(entry.id, overrides),
      });
      expect(response.status, JSON.stringify(overrides)).toBe(422);
    }
  });
});

describe('stats', () => {
  it('requires a valid "today"', async () => {
    const { cookie } = await h.signUp();
    expect((await h.call('/v1/me/stats', { cookie })).status).toBe(422);
    expect((await h.call('/v1/me/stats?today=2026-13-01', { cookie })).status).toBe(422);
  });

  it('starts at zero for a new reader (no invented progress)', async () => {
    const { cookie } = await h.signUp();
    const stats = statsResponseSchema.parse(
      await (await h.call('/v1/me/stats?today=2026-09-26', { cookie })).json(),
    );
    expect(stats).toEqual({
      today: '2026-09-26',
      xpTotal: 0,
      streakDays: 0,
      sessionsCount: 0,
      focusedMinutesThisWeek: 0,
      weekActiveDates: [],
      readToday: false,
      reviewedToday: false,
      dueCards: 0,
    });
  });

  it('computes streak and week activity from local dates', async () => {
    const { cookie } = await h.signUp();
    const entry = shelfEntrySchema.parse(
      (await addBook(cookie, { title: 'Semana', totalPages: 300 })).body,
    );
    await h.call('/v1/sessions', {
      method: 'POST',
      cookie,
      json: sessionBody(entry.id, {
        startedAt: '2026-09-25T14:00:00.000Z',
        endedAt: '2026-09-25T14:20:00.000Z',
        focusedSeconds: 20 * 60,
        endPage: 20,
        localDate: '2026-09-25',
      }),
    });
    const yesterdayOnly = statsResponseSchema.parse(
      await (await h.call('/v1/me/stats?today=2026-09-26', { cookie })).json(),
    );
    expect(yesterdayOnly).toMatchObject({
      streakDays: 1,
      readToday: false,
      weekActiveDates: ['2026-09-25'],
    });

    await h.call('/v1/sessions', {
      method: 'POST',
      cookie,
      json: sessionBody(entry.id, { endPage: 60 }),
    });
    const both = statsResponseSchema.parse(
      await (await h.call('/v1/me/stats?today=2026-09-26', { cookie })).json(),
    );
    expect(both).toMatchObject({
      streakDays: 2,
      readToday: true,
      sessionsCount: 2,
      xpTotal: 45,
      focusedMinutesThisWeek: 45,
      weekActiveDates: ['2026-09-25', '2026-09-26'],
    });
  });
});
