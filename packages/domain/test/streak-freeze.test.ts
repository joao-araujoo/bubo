import { describe, expect, it } from 'vitest';

import { addDays, computeStreak, computeStreakState } from '../src';

const rules = { since: '2026-10-01', earnEvery: 7, max: 2 };
/** `count` consecutive dates starting at `from`. */
const run = (from: string, count: number) =>
  Array.from({ length: count }, (_, index) => addDays(from, index));

describe('computeStreakState (streak protection)', () => {
  it('matches the plain streak while no protection was earned', () => {
    const dates = ['2026-10-02', '2026-10-03', '2026-10-05'];
    const state = computeStreakState(dates, '2026-10-05', rules);
    expect(state).toEqual({
      streakDays: computeStreak(dates, '2026-10-05'),
      frozenDates: [],
      freezesAvailable: 0,
      freezeProgress: 1,
    });
  });

  it('earns one protection every seven active days, up to the maximum', () => {
    expect(computeStreakState(run('2026-10-01', 7), '2026-10-07', rules)).toMatchObject({
      streakDays: 7,
      freezesAvailable: 1,
      freezeProgress: 0,
    });
    expect(computeStreakState(run('2026-10-01', 23), '2026-10-23', rules)).toMatchObject({
      streakDays: 23,
      freezesAvailable: 2,
      freezeProgress: 2,
    });
  });

  it('covers a missed day automatically and keeps the streak without counting it', () => {
    const dates = [...run('2026-10-01', 7), '2026-10-09'];
    const state = computeStreakState(dates, '2026-10-09', rules);
    expect(state).toEqual({
      streakDays: 8,
      frozenDates: ['2026-10-08'],
      freezesAvailable: 0,
      freezeProgress: 1,
    });
  });

  it('keeps the streak alive today when yesterday was covered', () => {
    const state = computeStreakState(run('2026-10-01', 7), '2026-10-09', rules);
    expect(state.frozenDates).toEqual(['2026-10-08']);
    expect(state.streakDays).toBe(7);
  });

  it('breaks once protections run out and resets progress', () => {
    const dates = [...run('2026-10-01', 7), '2026-10-11', '2026-10-12'];
    const state = computeStreakState(dates, '2026-10-12', rules);
    expect(state).toEqual({
      streakDays: 2,
      frozenDates: ['2026-10-08'],
      freezesAvailable: 0,
      freezeProgress: 2,
    });
  });

  it('never consumes a protection for today, which is still open', () => {
    const state = computeStreakState(run('2026-10-01', 7), '2026-10-08', rules);
    expect(state).toMatchObject({ streakDays: 7, frozenDates: [], freezesAvailable: 1 });
  });

  it('is not applied before the rule started', () => {
    const dates = [...run('2026-09-20', 7), '2026-09-28'];
    expect(computeStreakState(dates, '2026-09-28', rules)).toEqual({
      streakDays: 1,
      frozenDates: [],
      freezesAvailable: 0,
      freezeProgress: 0,
    });
  });

  it('ignores future dates', () => {
    const state = computeStreakState(['2026-10-02', '2026-10-30'], '2026-10-02', rules);
    expect(state.streakDays).toBe(1);
  });
});
