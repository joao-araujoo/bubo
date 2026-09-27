import { describe, expect, it } from 'vitest';

import {
  INITIAL_SCHEDULE,
  MIN_EASE_FACTOR,
  XP_RULES,
  estimateRetention,
  scheduleNextReview,
  xpForReadingSession,
  xpForRecallSession,
} from '../src';

describe('estimateRetention', () => {
  it('is 1 right after review and decays over time', () => {
    expect(estimateRetention(0, 5)).toBe(1);
    expect(estimateRetention(5, 5)).toBeCloseTo(Math.exp(-1));
    expect(estimateRetention(10, 5)).toBeLessThan(estimateRetention(5, 5));
  });

  it('handles invalid stability safely', () => {
    expect(estimateRetention(3, 0)).toBe(0);
    expect(estimateRetention(Number.NaN, 3)).toBe(1);
  });
});

describe('scheduleNextReview (SM-2)', () => {
  it('grows the interval 1 → 6 → ×ease on good recalls', () => {
    const first = scheduleNextReview(INITIAL_SCHEDULE, 4);
    expect(first).toMatchObject({ repetitions: 1, intervalDays: 1 });
    const second = scheduleNextReview(first, 4);
    expect(second).toMatchObject({ repetitions: 2, intervalDays: 6 });
    const third = scheduleNextReview(second, 5);
    expect(third.repetitions).toBe(3);
    expect(third.intervalDays).toBe(Math.round(6 * third.easeFactor));
  });

  it('resets on a failed recall', () => {
    const learned = { repetitions: 4, intervalDays: 20, easeFactor: 2.5 };
    expect(scheduleNextReview(learned, 1)).toMatchObject({ repetitions: 0, intervalDays: 1 });
  });

  it('never lets the ease factor drop below the minimum', () => {
    let schedule = INITIAL_SCHEDULE;
    for (let i = 0; i < 20; i++) schedule = scheduleNextReview(schedule, 0);
    expect(schedule.easeFactor).toBeGreaterThanOrEqual(MIN_EASE_FACTOR);
  });
});

describe('XP', () => {
  it('rewards focused minutes up to the per-session cap', () => {
    expect(xpForReadingSession({ focusedMinutes: 25 })).toBe(25);
    expect(xpForReadingSession({ focusedMinutes: 500 })).toBe(XP_RULES.maxFocusedMinutesPerSession);
    expect(xpForReadingSession({ focusedMinutes: -3 })).toBe(0);
  });

  it('rewards recall effort, accuracy and completion', () => {
    expect(xpForRecallSession({ attempts: 3, correct: 2, completed: true })).toBe(
      3 * 2 + 2 * 3 + 25,
    );
    expect(xpForRecallSession({ attempts: 0, correct: 0, completed: true })).toBe(0);
    expect(xpForRecallSession({ attempts: 2, correct: 9, completed: false })).toBe(2 * 2 + 2 * 3);
  });
});
