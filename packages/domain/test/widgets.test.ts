import { describe, expect, it } from 'vitest';

import {
  buildWidgetMonth,
  buildWidgetMoods,
  buildWidgetSnapshot,
  leaguePodium,
  moodAt,
  nameInitials,
  toLocalIsoDate,
  widgetMoodNow,
} from '../src';

function input(hour = 12) {
  const now = new Date(2026, 9, 1, hour);
  const today = toLocalIsoDate(now);
  return {
    now,
    updatedAt: now.getTime(),
    hideBookOnLockScreen: true,
    weeklyGoal: 4,
    entries: [
      {
        id: 'finished',
        status: 'finished',
        currentPage: 100,
        book: { title: 'Terminado', totalPages: 100, coverUrls: [] },
      },
      {
        id: 'book/1',
        status: 'reading',
        currentPage: 25,
        book: {
          title: 'Em leitura',
          totalPages: 100,
          coverUrls: ['http://insecure', 'https://example.com/cover.png'],
        },
      },
    ],
    stats: {
      today,
      streakDays: 3,
      weekReadingDates: ['2026-09-28', today, today, '2026-10-04', '2026-09-21'],
      weekActiveDates: ['2026-09-28', '2026-09-30', today],
      monthActiveDates: [today, '2026-10-04'],
      readToday: true,
      reviewedToday: false,
    },
    due: { today, cards: [{}], dueCount: 20, nextDueDate: '2026-10-03' },
  };
}

const moodInput = {
  valid: true,
  streakDays: 12,
  activeToday: false,
  readToday: false,
  goalMet: false,
  availableReviews: 0,
  hasBook: true,
};

describe('system widgets', () => {
  it('uses the latest reading book, real streak activity and reading-only goal days', () => {
    const snapshot = buildWidgetSnapshot(input());
    expect(snapshot).toMatchObject({
      version: 3,
      streakDays: 3,
      activeToday: true,
      activeDays: 2,
      availableReviews: 1,
      pendingReviews: 20,
      tone: 'done',
      pose: 'celebrating',
      message: 'Leitura feita hoje!',
      hideBookOnLockScreen: true,
    });
    expect(snapshot.book).toMatchObject({
      title: 'Em leitura',
      page: 25,
      progress: 25,
      coverUrl: 'https://example.com/cover.png',
      url: 'bubo://livro/book%2F1',
      sessionUrl: 'bubo://sessao/book%2F1',
    });
    expect(snapshot.week.map((day) => day.state)).toEqual([
      'done',
      'missed',
      'done',
      'today',
      'future',
      'future',
      'future',
    ]);
    expect(snapshot.week.filter((day) => day.read)).toHaveLength(2);
  });

  it('has honest empty states, without invented book, streak or urgency', () => {
    const data = input();
    data.entries = [];
    data.stats = {
      ...data.stats,
      streakDays: 0,
      weekReadingDates: [],
      weekActiveDates: [],
      monthActiveDates: [],
      readToday: false,
    };
    data.due.cards = [];
    const snapshot = buildWidgetSnapshot(data);
    expect(snapshot).toMatchObject({
      book: null,
      streakDays: 0,
      activeToday: false,
      activeDays: 0,
      availableReviews: 0,
      pose: 'curious',
      tone: 'welcome',
      league: null,
    });
    // Without a streak there is nothing to lose: no "last chance" at night.
    expect(snapshot.moods.map((mood) => mood.tone)).not.toContain('risk');
    expect(snapshot.month.days.some((day) => day.active)).toBe(false);
  });

  it('nudges harder through the evening only while a real streak is at risk', () => {
    const moods = buildWidgetMoods(moodInput);
    expect(moods.map((mood) => [mood.fromHour, mood.tone, mood.pose])).toEqual([
      [0, 'night', 'sleeping'],
      [6, 'calm', 'reading'],
      [18, 'risk', 'worried'],
      [21, 'risk', 'surprised'],
      [22, 'risk', 'worried'],
    ]);
    expect(moodAt(moods, 5).pose).toBe('sleeping');
    expect(moodAt(moods, 20).message).toBe('Salve sua sequência!');
    expect(moodAt(moods, 23).message).toBe('Última chance!');
    expect(moods.every((mood) => !mood.lit)).toBe(true);
    expect(moods.map((mood) => mood.alert)).toEqual([false, false, true, true, true]);
  });

  it('celebrates real activity and the weekly goal, then sleeps at night', () => {
    const read = buildWidgetMoods({ ...moodInput, activeToday: true, readToday: true });
    expect(moodAt(read, 12)).toMatchObject({ tone: 'done', pose: 'celebrating', lit: true });
    expect(moodAt(read, 23)).toMatchObject({ tone: 'night', pose: 'sleeping', lit: true });
    const reviewed = buildWidgetMoods({ ...moodInput, activeToday: true });
    expect(moodAt(reviewed, 12).pose).toBe('cheering');
    const goal = buildWidgetMoods({ ...moodInput, activeToday: true, goalMet: true });
    expect(moodAt(goal, 12)).toMatchObject({ tone: 'done', pose: 'achievement' });
    const due = buildWidgetMoods({ ...moodInput, availableReviews: 2 });
    expect(moodAt(due, 9)).toMatchObject({ pose: 'review', message: '2 revisões te esperam' });
    expect(moodAt(buildWidgetMoods({ ...moodInput, availableReviews: 1 }), 9).message).toBe(
      '1 revisão te espera',
    );
  });

  it('joins consecutive active days into runs that never wrap across weeks', () => {
    // October 2026 starts on a Thursday: offset 3 with Monday first.
    const month = buildWidgetMonth(
      '2026-10-06',
      new Set(['2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-09']),
    );
    expect(month).toMatchObject({ label: 'Outubro', title: 'Outubro 2026', offset: 3 });
    expect(month.days).toHaveLength(31);
    const run = (day: number) => month.days[day - 1]?.run;
    expect([run(3), run(4), run(5), run(6), run(7), run(9)]).toEqual([
      'start',
      'end', // Sunday ends the row
      'start', // Monday starts a new row
      'end',
      'none',
      'single',
    ]);
    expect(month.days[5]).toMatchObject({ today: true, future: false });
    expect(month.days[6]?.future).toBe(true);
  });

  it('ignores future dates in the calendar and keeps February short', () => {
    const snapshot = buildWidgetSnapshot(input());
    expect(snapshot.month.days.find((day) => day.day === 4)?.active).toBe(false);
    expect(buildWidgetMonth('2027-02-10', new Set()).days).toHaveLength(28);
  });

  it('expires at local midnight and never extends stale server data by reopening the app', () => {
    const data = input(23);
    expect(buildWidgetSnapshot(data).expiresAt).toBe(new Date(2026, 9, 2).getTime());
    data.updatedAt -= 2 * 86_400_000;
    expect(buildWidgetSnapshot(data).expiresAt).toBeLessThan(data.now.getTime());
    data.stats.today = '2026-09-30';
    expect(buildWidgetSnapshot(data)).toMatchObject({
      availableReviews: 0,
      pendingReviews: 0,
      streakDays: 0,
      activeToday: false,
      tone: 'stale',
      pose: 'doubt',
    });
    data.updatedAt = data.now.getTime();
    expect(buildWidgetSnapshot(data).expiresAt).toBeLessThan(data.now.getTime());
  });

  it('shows honest fallbacks when the widget has no data or the data went stale', () => {
    expect(widgetMoodNow(null, new Date(2026, 9, 1, 12))).toMatchObject({
      pose: 'welcome',
      fresh: false,
      title: 'Olá!',
    });
    const snapshot = buildWidgetSnapshot(input());
    expect(widgetMoodNow(snapshot, new Date(2026, 9, 1, 12))).toMatchObject({
      fresh: true,
      tone: 'done',
      title: null,
    });
    expect(widgetMoodNow(snapshot, new Date(2026, 9, 1, 23))).toMatchObject({ tone: 'night' });
    // Next day: yesterday's streak and activity are never shown as today's.
    expect(widgetMoodNow(snapshot, new Date(2026, 9, 2, 9))).toMatchObject({
      tone: 'stale',
      pose: 'doubt',
      lit: false,
      title: 'Abra o Bubo',
    });
    expect(widgetMoodNow(snapshot, new Date(2026, 9, 2, 3))).toMatchObject({
      tone: 'night',
      pose: 'sleeping',
    });
  });

  it('keeps page unknown and clamps progress and goal without manufacturing a total', () => {
    const data = input();
    data.entries = [
      {
        id: 'unknown',
        status: 'reading',
        currentPage: 25,
        book: { title: 'Sem total', totalPages: 0, coverUrls: [] },
      },
    ];
    expect(buildWidgetSnapshot(data).book?.progress).toBeNull();
    data.entries[0]!.book.totalPages = 10;
    data.weeklyGoal = 99;
    expect(buildWidgetSnapshot(data)).toMatchObject({ weeklyGoal: 7, book: { progress: 100 } });
  });

  it('shows protected days, ready protections and a calm evening when a protection is ready', () => {
    const data = input();
    const snapshot = buildWidgetSnapshot({
      ...data,
      stats: {
        ...data.stats,
        weekActiveDates: ['2026-09-28', today()],
        streakFreeze: { available: 1, max: 2, frozenDates: ['2026-09-29', '2026-09-30'] },
      },
    });
    expect(snapshot.week.map((day) => day.state)).toEqual([
      'done',
      'frozen',
      'frozen',
      'today',
      'future',
      'future',
      'future',
    ]);
    expect(snapshot.week.map((day) => day.letter).join('')).toBe('STQQSSD');
    expect(snapshot.freeze).toEqual({ available: 1, max: 2, frozenYesterday: true });
    // September days never leak into October's grid; inside the month they stand alone.
    expect(snapshot.month.days.some((day) => day.frozen)).toBe(false);
    const month = buildWidgetMonth(
      '2026-10-09',
      new Set(['2026-10-06', '2026-10-08']),
      new Set(['2026-10-07', '2026-10-08']),
    );
    expect(month.days.slice(5, 8).map((day) => [day.run, day.frozen])).toEqual([
      ['single', false],
      ['none', true],
      ['single', false], // active wins over protection
    ]);
    const evening = buildWidgetMoods({ ...moodInput, freezesAvailable: 1 });
    expect(evening.some((mood) => mood.alert)).toBe(false);
    expect(moodAt(evening, 19).message).toBe('Leia hoje: a proteção fica guardada');
    const saved = buildWidgetMoods({ ...moodInput, hasBook: false, frozenYesterday: true });
    expect(moodAt(saved, 9).message).toBe('A proteção salvou sua sequência');
  });

  it('puts the reader on the podium with real neighbours and drops a stale league', () => {
    const entries = [1, 2, 3, 4, 5].map((rank) => ({ rank, me: rank === 3 }));
    expect(leaguePodium(entries, 3).map((entry) => entry.rank)).toEqual([4, 3, 2]);
    expect(leaguePodium(entries, 1).map((entry) => entry.rank)).toEqual([3, 2, 1]);
    expect(leaguePodium(entries, 5).map((entry) => entry.rank)).toEqual([5, 4, 3]);
    expect(leaguePodium(entries.slice(0, 1), 1).map((entry) => entry.rank)).toEqual([1]);
    expect(nameInitials('Ana Maria Leitora')).toBe('AL');
    const league = {
      today: today(),
      daysLeft: 4,
      me: { rank: 1, previousRank: 2, weeklyXp: 60 },
      entries: [
        { rank: 1, name: 'Eu Mesmo', weeklyXp: 60, me: true },
        { rank: 2, name: 'Lia', weeklyXp: 30, me: false },
      ],
    };
    expect(buildWidgetSnapshot({ ...input(), league }).league).toEqual({
      rank: 1,
      previousRank: 2,
      participants: 2,
      weeklyXp: 60,
      daysLeft: 4,
      podium: [
        { rank: 2, initials: 'L', xp: 30, me: false },
        { rank: 1, initials: 'EM', xp: 60, me: true },
      ],
    });
    expect(
      buildWidgetSnapshot({ ...input(), league: { ...league, today: '2026-09-30' } }).league,
    ).toBeNull();
  });
});

function today() {
  return toLocalIsoDate(new Date(2026, 9, 1, 12));
}
