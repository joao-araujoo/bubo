import { describe, expect, it } from 'vitest';

import { cycleDaysLeft, cycleGroupPercent, cycleHistorySummary, cycleWeeks } from '../src';

const cycle = (participantCount: number, participantsAtGoal: number, totalPagesRead: number) => ({
  goalPages: 100,
  participantCount,
  participantsAtGoal,
  totalPagesRead,
});

describe('club reading cycles', () => {
  it('measures group progress against goal × participants, capped at 100', () => {
    expect(cycleGroupPercent(cycle(4, 1, 250))).toBe(62);
    expect(cycleGroupPercent(cycle(2, 2, 900))).toBe(100);
    expect(cycleGroupPercent(cycle(0, 0, 0))).toBe(0);
  });

  it('counts partial days as a day left and never goes negative', () => {
    const now = new Date('2026-09-30T12:00:00Z');
    expect(cycleDaysLeft(new Date('2026-10-14T12:00:00Z'), now)).toBe(14);
    expect(cycleDaysLeft(new Date('2026-09-30T13:00:00Z'), now)).toBe(1);
    expect(cycleDaysLeft(new Date('2026-09-29T12:00:00Z'), now)).toBe(0);
  });

  it('reports cycle length in whole weeks, at least one', () => {
    const start = new Date('2026-08-01T00:00:00Z');
    expect(cycleWeeks(start, new Date('2026-09-26T00:00:00Z'))).toBe(8);
    expect(cycleWeeks(start, new Date('2026-08-02T00:00:00Z'))).toBe(1);
  });

  it('summarises closed cycles without inventing a rate when nobody took part', () => {
    expect(cycleHistorySummary([cycle(4, 3, 380), cycle(2, 0, 40)])).toEqual({
      completed: 2,
      pagesRead: 420,
      goalRate: 50,
    });
    expect(cycleHistorySummary([cycle(0, 0, 0)])).toEqual({
      completed: 1,
      pagesRead: 0,
      goalRate: null,
    });
  });
});
