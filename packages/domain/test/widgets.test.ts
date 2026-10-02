import { describe, expect, it } from 'vitest';

import {
  buildWidgetMonth,
  buildWidgetMoods,
  buildWidgetSnapshot,
  moodAt,
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
      version: 2,
      streakDays: 3,
      activeToday: true,
      activeDays: 2,
      availableReviews: 1,
      pendingReviews: 20,
      scene: 'gold',
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
      pose: 'welcome',
      scene: 'candy',
    });
    // Without a streak there is nothing to lose: no "last chance" at night.
    expect(snapshot.moods.map((mood) => mood.scene)).not.toContain('alarm');
    expect(snapshot.month.days.some((day) => day.active)).toBe(false);
  });

  it('nudges harder through the evening only while a real streak is at risk', () => {
    const moods = buildWidgetMoods(moodInput);
    expect(moods.map((mood) => [mood.fromHour, mood.scene, mood.pose])).toEqual([
      [0, 'night', 'sleeping'],
      [6, 'sky', 'reading'],
      [18, 'sunset', 'worried'],
      [21, 'alarm', 'surprised'],
      [22, 'alarm', 'worried'],
    ]);
    expect(moodAt(moods, 5).pose).toBe('sleeping');
    expect(moodAt(moods, 20).message).toBe('Salve sua sequência!');
    expect(moodAt(moods, 23).message).toBe('Última chance!');
    expect(moods.every((mood) => !mood.lit)).toBe(true);
    expect(moods.map((mood) => mood.alert)).toEqual([false, false, true, true, true]);
  });

  it('celebrates real activity and the weekly goal, then sleeps at night', () => {
    const read = buildWidgetMoods({ ...moodInput, activeToday: true, readToday: true });
    expect(moodAt(read, 12)).toMatchObject({ scene: 'gold', pose: 'celebrating', lit: true });
    expect(moodAt(read, 23)).toMatchObject({ scene: 'night', pose: 'sleeping', lit: true });
    const reviewed = buildWidgetMoods({ ...moodInput, activeToday: true });
    expect(moodAt(reviewed, 12).pose).toBe('cheering');
    const goal = buildWidgetMoods({ ...moodInput, activeToday: true, goalMet: true });
    expect(moodAt(goal, 12)).toMatchObject({ scene: 'mint', pose: 'achievement' });
    const due = buildWidgetMoods({ ...moodInput, availableReviews: 2 });
    expect(moodAt(due, 9)).toMatchObject({ scene: 'teal', message: '2 revisões te esperam' });
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
    expect(month).toMatchObject({ label: 'Outubro', offset: 3 });
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
      scene: 'slate',
      pose: 'doubt',
    });
    data.updatedAt = data.now.getTime();
    expect(buildWidgetSnapshot(data).expiresAt).toBeLessThan(data.now.getTime());
  });

  it('shows honest fallbacks when the widget has no data or the data went stale', () => {
    expect(widgetMoodNow(null, new Date(2026, 9, 1, 12))).toMatchObject({
      scene: 'lavender',
      fresh: false,
      title: 'Olá!',
    });
    const snapshot = buildWidgetSnapshot(input());
    expect(widgetMoodNow(snapshot, new Date(2026, 9, 1, 12))).toMatchObject({
      fresh: true,
      scene: 'gold',
      title: null,
    });
    expect(widgetMoodNow(snapshot, new Date(2026, 9, 1, 23))).toMatchObject({ scene: 'night' });
    // Next day: yesterday's streak and activity are never shown as today's.
    expect(widgetMoodNow(snapshot, new Date(2026, 9, 2, 9))).toMatchObject({
      scene: 'slate',
      pose: 'doubt',
      lit: false,
      title: 'Abra o Bubo',
    });
    expect(widgetMoodNow(snapshot, new Date(2026, 9, 2, 3))).toMatchObject({
      scene: 'night',
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
});
