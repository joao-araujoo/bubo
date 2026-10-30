import { describe, expect, it } from 'vitest';

import {
  computeReplay,
  createReplayPeriod,
  isReplayTimeZone,
  toReplayLocalDate,
  type ReplayBookInput,
  type ReplayPeriodInput,
  type ReplaySessionInput,
} from '../src/replay';

const now = new Date('2026-10-15T16:00:00Z');
const query: ReplayPeriodInput = {
  kind: 'month',
  year: 2026,
  month: 10,
  timeZone: 'America/Sao_Paulo',
};
const book = (
  id = 'entry-a',
  overrides: Partial<ReplayBookInput<{ title: string }>> = {},
): ReplayBookInput<{ title: string }> => ({
  shelfEntryId: id,
  book: { title: id },
  author: 'Clarice Lispector',
  firstReadAt: new Date('2026-10-01T13:00:00Z'),
  lastReadAt: new Date('2026-10-15T13:00:00Z'),
  completionAt: null,
  ...overrides,
});
const session = (
  id: string,
  endedAt: string,
  overrides: Partial<ReplaySessionInput> = {},
): ReplaySessionInput => ({
  id,
  shelfEntryId: 'entry-a',
  startedAt: new Date(Date.parse(endedAt) - 600000),
  endedAt: new Date(endedAt),
  focusedSeconds: 600,
  startPage: 0,
  endPage: 10,
  ...overrides,
});
const replay = (
  sessions: ReplaySessionInput[],
  books = [book()],
  periodQuery = query,
  firstSessionAt: Date | null = books[0]?.firstReadAt ?? null,
) =>
  computeReplay({
    period: createReplayPeriod(periodQuery, now),
    now,
    sessions,
    books,
    firstSessionAt,
  });

describe('Replay calendar periods', () => {
  it('uses complete calendar ranges with leap years and an explicit zone', () => {
    expect(
      createReplayPeriod({ kind: 'month', year: 2024, month: 2, timeZone: 'UTC' }, now),
    ).toMatchObject({ startDate: '2024-02-01', endDate: '2024-02-29', inProgress: false });
    expect(createReplayPeriod({ kind: 'year', year: 2026, timeZone: 'UTC' }, now)).toMatchObject({
      month: null,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      inProgress: true,
    });
    expect(toReplayLocalDate(new Date('2026-10-01T01:00:00Z'), 'America/Sao_Paulo')).toBe(
      '2026-09-30',
    );
  });

  it('rejects invalid years/months/zones and periods that have not started', () => {
    for (const timeZone of ['Brazil/Imaginary', '+03:00', 'GMT', '', 'America/Sao_Paulo<script>'])
      expect(isReplayTimeZone(timeZone)).toBe(false);
    for (const timeZone of [
      'UTC',
      'America/Sao_Paulo',
      'America/New_York',
      'Pacific/Kiritimati',
      'Etc/GMT+12',
    ])
      expect(isReplayTimeZone(timeZone)).toBe(true);
    for (const input of [
      { ...query, month: 13 },
      { ...query, month: 0 },
      { ...query, year: 2019 },
      { ...query, month: undefined },
      { ...query, year: 2027 },
      { ...query, month: 11 },
      { ...query, kind: 'year' as const },
      { ...query, timeZone: 'wrong' },
    ])
      expect(() => createReplayPeriod(input, now)).toThrow(RangeError);
  });
});

describe('Replay from accepted sessions', () => {
  it('reports a reproducible server snapshot time independent of the device clock', () => {
    const result = replay([session('a', '2026-10-01T13:00:00Z')]);
    expect(result.generatedAt).toBe('2026-10-15T16:00:00.000Z');
    expect(replay([session('a', '2026-10-01T13:00:00Z')])).toEqual(result);
  });

  it('counts focus, page deltas, books and real consecutive days without multiplying same-day sessions', () => {
    const result = replay([
      session('a', '2026-10-01T13:00:00Z'),
      session('b', '2026-10-01T15:00:00Z', { focusedSeconds: 61, startPage: 10, endPage: 10 }),
      session('c', '2026-10-02T13:00:00Z', { endPage: 15 }),
      session('d', '2026-10-04T13:00:00Z', { startPage: 18, endPage: 20 }),
    ]);
    expect(result.totals).toEqual({
      booksRead: 1,
      booksStarted: 1,
      booksFinished: 0,
      pagesRead: 27,
      focusedSeconds: 1861,
      focusedMinutes: 31,
      sessionsCount: 4,
      readingDays: 3,
      bestStreakDays: 2,
    });
    expect(result.books[0]).toMatchObject({ sessionsCount: 4, readingDays: 3 });
    expect(result.highlights.mostReadBookId).toBe('entry-a');
  });

  it('clips the period by end time in the selected timezone and excludes future or unrelated rows', () => {
    const result = replay([
      session('before', '2026-10-01T02:59:59Z'),
      session('inside', '2026-10-01T03:00:00Z'),
      session('future', '2026-10-16T12:00:00Z'),
      session('missing-book', '2026-10-02T12:00:00Z', { shelfEntryId: 'not-owned' }),
    ]);
    expect(result.totals).toMatchObject({ sessionsCount: 1, readingDays: 1, bestStreakDays: 1 });
    expect(result.highlights.mostReadBookId).toBeNull();
  });

  it('handles DST and both extreme named timezone offsets without fixed-offset assumptions', () => {
    expect(toReplayLocalDate(new Date('2026-03-08T04:59:59Z'), 'America/New_York')).toBe(
      '2026-03-07',
    );
    expect(toReplayLocalDate(new Date('2026-03-08T07:00:00Z'), 'America/New_York')).toBe(
      '2026-03-08',
    );
    expect(toReplayLocalDate(new Date('2026-01-01T00:30:00Z'), 'Pacific/Kiritimati')).toBe(
      '2026-01-01',
    );
    expect(toReplayLocalDate(new Date('2026-01-01T00:30:00Z'), 'Etc/GMT+12')).toBe('2025-12-31');
  });

  it('starts only from first observed reading and finishes only from supplied session evidence', () => {
    const result = replay(
      [
        session('a', '2026-10-02T13:00:00Z'),
        session('b', '2026-10-03T13:00:00Z', { shelfEntryId: 'entry-b' }),
      ],
      [
        book('entry-a', {
          firstReadAt: new Date('2026-09-29T13:00:00Z'),
          completionAt: new Date('2026-10-02T13:00:00Z'),
        }),
        book('entry-b', { firstReadAt: new Date('2026-10-03T13:00:00Z'), author: null }),
      ],
    );
    expect(result.totals).toMatchObject({ booksRead: 2, booksStarted: 1, booksFinished: 1 });
    expect(result.highlights.longestBook).toEqual({ shelfEntryId: 'entry-a', spanDays: 4 });
    expect(result.topAuthors).toEqual([
      {
        author: 'Clarice Lispector',
        booksRead: 1,
        pagesRead: 10,
        focusedSeconds: 600,
        sessionsCount: 1,
      },
    ]);
  });

  it('keeps twelve annual months and reconciles monthly totals with the annual session totals', () => {
    const result = replay(
      [
        session('jan', '2026-01-31T13:00:00Z', { focusedSeconds: 1200 }),
        session('feb', '2026-02-01T13:00:00Z'),
        session('oct', '2026-10-01T13:00:00Z', { shelfEntryId: 'entry-b' }),
      ],
      [
        book('entry-a', {
          firstReadAt: new Date('2026-01-31T13:00:00Z'),
          completionAt: new Date('2026-02-01T13:00:00Z'),
        }),
        book('entry-b'),
      ],
      { kind: 'year', year: 2026, timeZone: 'America/Sao_Paulo' },
    );
    expect(result.months).toHaveLength(12);
    expect(result.months[0]).toMatchObject({
      booksRead: 1,
      booksStarted: 1,
      booksFinished: 0,
      sessionsCount: 1,
    });
    expect(result.months[1]).toMatchObject({
      booksRead: 1,
      booksStarted: 0,
      booksFinished: 1,
      sessionsCount: 1,
    });
    expect(result.months.reduce((total, item) => total + item.focusedSeconds, 0)).toBe(
      result.totals.focusedSeconds,
    );
    expect(result.months.reduce((total, item) => total + item.pagesRead, 0)).toBe(
      result.totals.pagesRead,
    );
    expect(result.totals.bestStreakDays).toBe(2);
    expect(result.highlights.bestMonth).toBe(1);
  });

  it('requires five sessions and an unambiguous favorite local starting hour', () => {
    const readings = Array.from({ length: 5 }, (_, index) =>
      session(String(index), `2026-10-0${index + 1}T13:10:00Z`),
    );
    expect(replay(readings.slice(0, 4)).highlights.favoriteHour).toBeNull();
    expect(replay(readings).highlights.favoriteHour).toEqual({ hour: 10, sessionsCount: 5 });
    const tied = readings.slice(0, 3).concat(
      readings.slice(0, 3).map((item) => ({
        ...item,
        id: `${item.id}-later`,
        startedAt: new Date(item.startedAt.getTime() + 3600000),
      })),
    );
    expect(replay(tied).highlights.favoriteHour).toBeNull();
    const midnight = readings.map((item) => ({
      ...item,
      startedAt: new Date('2026-10-01T03:00:00Z'),
    }));
    expect(replay(midnight).highlights.favoriteHour?.hour).toBe(0);
  });

  it('uses focus for longest session and keeps coauthors exactly as stored', () => {
    const result = replay(
      [
        session('a', '2026-10-01T13:00:00Z', { focusedSeconds: 60 }),
        session('b', '2026-10-02T13:00:00Z', { focusedSeconds: 3600, shelfEntryId: 'entry-b' }),
      ],
      [book(), book('entry-b', { author: 'Nome, Sobrenome e Coautora' })],
    );
    expect(result.highlights.longestSession).toEqual({
      shelfEntryId: 'entry-b',
      focusedSeconds: 3600,
      localDate: '2026-10-02',
    });
    expect(result.topAuthors[0]?.author).toBe('Nome, Sobrenome e Coautora');
    expect(result.highlights.mostReadBookId).toBeNull();
  });

  it('deduplicates UUIDs and reports missing history and dimensions without invented data', () => {
    const reading = session('same', '2026-10-01T13:00:00Z');
    expect(replay([reading, reading]).totals.sessionsCount).toBe(1);
    const empty = replay([], [], query, null);
    expect(empty.totals).toMatchObject({
      booksRead: 0,
      focusedMinutes: 0,
      sessionsCount: 0,
      bestStreakDays: 0,
    });
    expect(empty.coverage).toEqual({
      firstSessionDate: null,
      partialHistory: true,
      source: 'accepted_reading_sessions',
    });
    expect(empty.highlights).toEqual({
      mostReadBookId: null,
      favoriteHour: null,
      longestSession: null,
      longestBook: null,
      bestMonth: null,
    });
    expect(empty.unavailableDimensions).toEqual(['genres', 'quotations', 'bridges', 'reflections']);
    expect(replay([], [], query, new Date('2026-09-01T13:00:00Z')).coverage.partialHistory).toBe(
      false,
    );
    expect(replay([], [], query, new Date('2026-10-02T13:00:00Z')).coverage.partialHistory).toBe(
      true,
    );
  });
});
