import { describe, expect, it } from 'vitest';

import { ACHIEVEMENTS, type AchievementMetrics, evaluateAchievements, longestStreak } from '../src';

const none: AchievementMetrics = {
  sessions: 0,
  focusedMinutes: 0,
  pagesRead: 0,
  booksFinished: 0,
  reflections: 0,
  reviews: 0,
  remembered: 0,
  longestStreak: 0,
};

describe('evaluateAchievements', () => {
  it('unlocks nothing without activity', () => {
    const result = evaluateAchievements(none);
    expect(result).toHaveLength(ACHIEVEMENTS.length);
    expect(result.every((a) => !a.unlocked && a.progress === 0)).toBe(true);
  });

  it('unlocks at the target and caps progress', () => {
    const result = evaluateAchievements({ ...none, sessions: 12, longestStreak: 14 });
    const byId = new Map(result.map((a) => [a.id, a]));
    expect(byId.get('first_session')).toMatchObject({ unlocked: true, progress: 1 });
    expect(byId.get('ten_sessions')).toMatchObject({ unlocked: true, progress: 10 });
    expect(byId.get('streak_14')).toMatchObject({ unlocked: true, progress: 14 });
    expect(byId.get('streak_100')).toMatchObject({ unlocked: false, progress: 14, target: 100 });
    expect(byId.get('first_review')?.unlocked).toBe(false);
  });

  it('never exposes the internal metric and has unique ids', () => {
    const result = evaluateAchievements(none);
    expect(result.some((a) => 'metric' in a)).toBe(false);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it('ignores fractional and negative values', () => {
    const result = evaluateAchievements({ ...none, focusedMinutes: 599.9, pagesRead: -3 });
    expect(result.find((a) => a.id === 'ten_hours')).toMatchObject({
      unlocked: false,
      progress: 599,
    });
    expect(result.find((a) => a.id === 'thousand_pages')?.progress).toBe(0);
  });
});

describe('longestStreak', () => {
  it('is 0 without dates', () => {
    expect(longestStreak([])).toBe(0);
  });

  it('finds the longest run regardless of order and duplicates', () => {
    expect(
      longestStreak([
        '2026-09-10',
        '2026-09-01',
        '2026-09-02',
        '2026-09-02',
        '2026-09-03',
        '2026-09-11',
      ]),
    ).toBe(3);
  });

  it('crosses month and year boundaries', () => {
    expect(longestStreak(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'])).toBe(4);
  });
});
