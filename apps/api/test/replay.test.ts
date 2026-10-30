import { meResponseSchema, replayResponseSchema } from '@bubo/contracts';
import { afterAll, beforeAll, expect, it } from 'vitest';

import { createHarness } from './harness';
import { VALID_SESSION_RECALL } from './session-fixtures';

let h: Awaited<ReturnType<typeof createHarness>>;
beforeAll(async () => {
  h = await createHarness({ now: () => new Date('2026-10-15T16:00:00Z') });
}, 60000);
afterAll(async () => h.close());

async function reader() {
  const { cookie } = await h.signUp();
  const me = meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
  return { cookie, id: me.user.id };
}

let sequence = 0;
async function book(
  userId: string,
  title: string,
  totalPages: number | null = 100,
  finished = false,
) {
  sequence += 1;
  const bookId = `replay-book-${sequence}`;
  const entryId = `replay-entry-${sequence}`;
  await h.database.pg.query(
    `INSERT INTO books (id, title, author, total_pages, created_by_user_id, cover_url)
     VALUES ($1, $2, 'Clarice Lispector', $3, $4, 'https://covers.openlibrary.org/b/id/123-L.jpg')`,
    [bookId, title, totalPages, userId],
  );
  await h.database.pg.query(
    `INSERT INTO shelf_entries (id, user_id, book_id, status, current_page, finished_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entryId,
      userId,
      bookId,
      finished ? 'finished' : 'reading',
      finished ? (totalPages ?? 0) : 0,
      finished ? '2026-10-03T13:00:00Z' : null,
    ],
  );
  return { bookId, entryId };
}

/** Historical accepted records (nullable legacy recall pair), never a pending mobile draft. */
async function session(
  userId: string,
  entryId: string,
  endedAt: string,
  startPage = 0,
  endPage = 10,
  focusedSeconds = 600,
) {
  sequence += 1;
  const startedAt = new Date(
    Date.parse(endedAt) - Math.max(focusedSeconds, 600) * 1000,
  ).toISOString();
  await h.database.pg.query(
    `INSERT INTO reading_sessions (id, user_id, shelf_entry_id, started_at, ended_at, focused_seconds, start_page, end_page, local_date, reflection)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PRIVATE THOUGHT NOT FOR SHARING')`,
    [
      `replay-session-${sequence}`,
      userId,
      entryId,
      startedAt,
      endedAt,
      focusedSeconds,
      startPage,
      endPage,
      endedAt.slice(0, 10),
    ],
  );
}

async function replay(
  cookie: string,
  query = 'kind=month&year=2026&month=10&timeZone=America%2FSao_Paulo',
) {
  const response = await h.call(`/v1/me/replay?${query}`, { cookie });
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  const json: unknown = await response.json();
  expect(JSON.stringify(json)).not.toContain('PRIVATE THOUGHT');
  expect(JSON.stringify(json)).not.toContain('reflection":');
  return replayResponseSchema.parse(json);
}

it('requires authentication, rejects invalid/future periods and returns honest empty history', async () => {
  const who = await reader();
  expect((await h.call('/v1/me/replay?kind=year&year=2026&timeZone=UTC')).status).toBe(401);
  for (const query of [
    'kind=month&year=2026&timeZone=UTC',
    'kind=year&year=2026&month=10&timeZone=UTC',
    'kind=year&year=2019&timeZone=UTC',
    'kind=month&year=2026&month=13&timeZone=UTC',
    'kind=year&year=2027&timeZone=UTC',
    'kind=month&year=2026&month=11&timeZone=UTC',
    'kind=year&year=2026&timeZone=Wrong%2FZone',
    'kind=year&year=2026',
  ])
    expect((await h.call(`/v1/me/replay?${query}`, { cookie: who.cookie })).status).toBe(422);
  const result = await replay(who.cookie);
  expect(result.generatedAt).toBe('2026-10-15T16:00:00.000Z');
  expect(result.totals).toMatchObject({
    booksRead: 0,
    booksStarted: 0,
    booksFinished: 0,
    pagesRead: 0,
    focusedSeconds: 0,
    sessionsCount: 0,
    readingDays: 0,
  });
  expect(result.coverage).toEqual({
    firstSessionDate: null,
    partialHistory: true,
    source: 'accepted_reading_sessions',
  });
  expect(result.books).toEqual([]);
  expect(result.topAuthors).toEqual([]);
  expect(result.period.inProgress).toBe(true);
});

it('includes a session only after API acceptance and counts an accepted UUID retry once', async () => {
  const who = await reader();
  const active = await book(who.id, 'Uma sessão de verdade');
  const input = {
    id: crypto.randomUUID(),
    shelfEntryId: active.entryId,
    startedAt: '2026-10-15T15:30:00.000Z',
    endedAt: '2026-10-15T16:00:00.000Z',
    focusedSeconds: 1800,
    endPage: 100,
    localDate: '2026-10-15',
  };
  expect(
    (await h.call('/v1/sessions', { method: 'POST', cookie: who.cookie, json: input })).status,
  ).toBe(422);
  expect((await replay(who.cookie)).totals.sessionsCount).toBe(0);
  expect(
    (
      await h.call('/v1/sessions', {
        method: 'POST',
        cookie: who.cookie,
        json: { ...input, recall: VALID_SESSION_RECALL },
      })
    ).status,
  ).toBe(201);
  expect(
    (await h.call('/v1/sessions', { method: 'POST', cookie: who.cookie, json: input })).status,
  ).toBe(200);
  const result = await replay(who.cookie);
  expect(result.totals).toMatchObject({
    booksRead: 1,
    booksStarted: 1,
    booksFinished: 1,
    sessionsCount: 1,
    pagesRead: 100,
    focusedSeconds: 1800,
  });
  expect(JSON.stringify(result)).not.toContain(VALID_SESSION_RECALL.idea);
});

it('isolates owner history, recomputes local dates and counts completion from session crossings alone', async () => {
  const who = await reader();
  const other = await reader();
  const active = await book(who.id, 'Uma leitura com histórico');
  const manual = await book(who.id, 'Adicionei como já lido', 100, true);
  const unknown = await book(who.id, 'Livro sem páginas', null, true);
  const outsider = await book(other.id, 'OUTSIDER PRIVATE BOOK');
  // Local Sept 30 despite the stored device date Oct 1: supplies historical start, not Oct totals.
  await session(who.id, active.entryId, '2026-10-01T01:00:00Z', 0, 10);
  await session(who.id, active.entryId, '2026-10-01T13:00:00Z', 10, 30, 1200);
  await session(who.id, active.entryId, '2026-10-02T13:00:00Z', 30, 100, 1800);
  await session(who.id, active.entryId, '2026-10-02T14:00:00Z', 100, 100, 600);
  await session(who.id, manual.entryId, '2026-10-03T13:00:00Z', 100, 100);
  await session(who.id, unknown.entryId, '2026-10-04T13:00:00Z', 0, 200);
  await session(other.id, outsider.entryId, '2026-10-02T13:00:00Z', 0, 100);
  // Even an inconsistent historic FK must satisfy both the session owner and the shelf owner.
  await session(who.id, outsider.entryId, '2026-10-02T13:00:00Z', 0, 100);
  await session(other.id, active.entryId, '2026-10-02T13:00:00Z', 0, 100);
  const result = await replay(who.cookie);
  expect(JSON.stringify(result)).not.toContain('OUTSIDER');
  expect(result.totals).toEqual({
    booksRead: 3,
    booksStarted: 2,
    booksFinished: 1,
    pagesRead: 290,
    focusedSeconds: 4800,
    focusedMinutes: 80,
    sessionsCount: 5,
    readingDays: 4,
    bestStreakDays: 4,
  });
  expect(result.books.find((item) => item.shelfEntryId === active.entryId)).toMatchObject({
    book: {
      title: 'Uma leitura com histórico',
      coverUrls: ['https://covers.openlibrary.org/b/id/123-L.jpg'],
    },
    firstReadDate: '2026-09-30',
    startedInPeriod: false,
    finishedInPeriod: true,
    completionDate: '2026-10-02',
    pagesRead: 90,
  });
  expect(result.books.find((item) => item.shelfEntryId === manual.entryId)?.finishedInPeriod).toBe(
    false,
  );
  expect(result.books.find((item) => item.shelfEntryId === unknown.entryId)?.finishedInPeriod).toBe(
    false,
  );
  expect(result.coverage).toMatchObject({ firstSessionDate: '2026-09-30', partialHistory: false });
  expect(result.highlights.mostReadBookId).toBe(active.entryId);
  expect(result.highlights.longestBook).toEqual({ shelfEntryId: active.entryId, spanDays: 3 });
  expect(result.highlights.favoriteHour).toEqual({ hour: 9, sessionsCount: 4 });
  expect(result.topAuthors).toEqual([
    {
      author: 'Clarice Lispector',
      booksRead: 3,
      pagesRead: 290,
      focusedSeconds: 4800,
      sessionsCount: 5,
    },
  ]);
});

it('supports annual month series, the reader page-count override, deletion and partial history', async () => {
  const who = await reader();
  const active = await book(who.id, 'Contagem da minha edição', 400);
  await h.database.pg.query(`UPDATE shelf_entries SET total_pages = 120 WHERE id = $1`, [
    active.entryId,
  ]);
  await session(who.id, active.entryId, '2026-02-28T13:00:00Z', 0, 60, 900);
  await session(who.id, active.entryId, '2026-03-01T13:00:00Z', 60, 120, 1800);
  // Not accepted on the server clock yet: excluded even though it is in the selected year.
  await session(who.id, active.entryId, '2026-12-31T13:00:00Z', 120, 120, 7200);
  const result = await replay(who.cookie, 'kind=year&year=2026&timeZone=America%2FSao_Paulo');
  expect(result.coverage).toEqual({
    firstSessionDate: '2026-02-28',
    partialHistory: true,
    source: 'accepted_reading_sessions',
  });
  expect(result.totals).toMatchObject({
    booksRead: 1,
    booksStarted: 1,
    booksFinished: 1,
    focusedSeconds: 2700,
    sessionsCount: 2,
    bestStreakDays: 2,
  });
  expect(result.books[0]?.book.totalPages).toBe(120);
  expect(result.months).toHaveLength(12);
  expect(result.months[1]).toMatchObject({
    month: 2,
    booksStarted: 1,
    booksFinished: 0,
    pagesRead: 60,
    focusedSeconds: 900,
  });
  expect(result.months[2]).toMatchObject({
    month: 3,
    booksStarted: 0,
    booksFinished: 1,
    pagesRead: 60,
    focusedSeconds: 1800,
  });
  expect(result.months[11]?.sessionsCount).toBe(0);
  expect(result.highlights.bestMonth).toBe(3);
  expect(result.highlights.longestBook).toEqual({ shelfEntryId: active.entryId, spanDays: 2 });
  expect(
    (await h.call(`/v1/shelf/${active.entryId}`, { method: 'DELETE', cookie: who.cookie })).status,
  ).toBe(200);
  const removed = await replay(who.cookie, 'kind=year&year=2026&timeZone=UTC');
  expect(removed.totals.sessionsCount).toBe(0);
  expect(removed.books).toEqual([]);
});

it('attributes sessions on the extreme IANA boundary and on daylight-saving days', async () => {
  const who = await reader();
  const active = await book(who.id, 'Fusos reais');
  await session(who.id, active.entryId, '2025-12-31T10:00:00Z');
  await session(who.id, active.entryId, '2026-01-01T11:59:59Z');
  await session(who.id, active.entryId, '2026-03-08T04:59:59Z');
  await session(who.id, active.entryId, '2026-03-08T07:00:00Z');
  const islands = await replay(
    who.cookie,
    'kind=month&year=2026&month=1&timeZone=Pacific%2FKiritimati',
  );
  expect(islands.totals.sessionsCount).toBe(2);
  const west = await replay(who.cookie, 'kind=month&year=2026&month=1&timeZone=Etc%2FGMT%2B12');
  expect(west.totals.sessionsCount).toBe(0);
  const dst = await replay(who.cookie, 'kind=month&year=2026&month=3&timeZone=America%2FNew_York');
  expect(dst.totals).toMatchObject({ sessionsCount: 2, readingDays: 2, bestStreakDays: 2 });
});
