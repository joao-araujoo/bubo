import { describe, expect, it } from 'vitest';

import {
  MONTHLY_CHALLENGE_DAYS,
  hoursUntilNextDay,
  monthlyChallenge,
  slippedCardIds,
  slippedWindowStart,
} from '../src/review-practice';

describe('the daily card renewal', () => {
  it('counts whole hours to the next local midnight', () => {
    expect(hoursUntilNextDay(new Date(2026, 9, 29, 15, 0))).toBe(9);
    expect(hoursUntilNextDay(new Date(2026, 9, 29, 15, 1))).toBe(9);
    expect(hoursUntilNextDay(new Date(2026, 9, 29, 0, 0))).toBe(24);
    expect(hoursUntilNextDay(new Date(2026, 9, 29, 23, 59))).toBe(1);
  });
});

describe('the month challenge', () => {
  const october = (days: number[]) => days.map((day) => `2026-10-${String(day).padStart(2, '0')}`);

  it('counts distinct active days of this month only', () => {
    const challenge = monthlyChallenge('2026-10-29', [
      ...october([2, 3, 3, 5]),
      '2026-09-30',
      '2026-10-30',
    ]);
    expect(challenge).toMatchObject({
      target: MONTHLY_CHALLENGE_DAYS,
      activeDays: 3,
      daysInMonth: 31,
      completed: false,
      reachable: false,
    });
  });

  it('keeps today available until it has activity', () => {
    expect(monthlyChallenge('2026-10-29', october([1])).available).toBe(3);
    expect(monthlyChallenge('2026-10-29', october([1, 29])).available).toBe(2);
  });

  it('is reachable while enough days are left and completed at the target', () => {
    expect(monthlyChallenge('2026-10-12', october([1, 2, 3])).reachable).toBe(true);
    const done = monthlyChallenge('2026-10-29', october([...Array(22).keys()].map((d) => d + 1)));
    expect(done).toMatchObject({ activeDays: 22, completed: true, reachable: true });
  });

  it('knows short months', () => {
    expect(monthlyChallenge('2027-02-10', []).daysInMonth).toBe(28);
  });
});

describe('cards que escaparam', () => {
  it('keeps cards whose latest attempt was a lapse, newest first', () => {
    const logs = [
      { cardId: 'a', grade: 1, reviewedAt: '2026-10-20T10:00:00.000Z' },
      { cardId: 'b', grade: 4, reviewedAt: '2026-10-21T10:00:00.000Z' },
      { cardId: 'c', grade: 0, reviewedAt: '2026-10-25T10:00:00.000Z' },
      { cardId: 'b', grade: 2, reviewedAt: '2026-10-10T10:00:00.000Z' },
      { cardId: 'a', grade: 2, reviewedAt: '2026-10-18T10:00:00.000Z' },
    ];
    expect(slippedCardIds(logs, 10)).toEqual(['c', 'a']);
    expect(slippedCardIds(logs, 1)).toEqual(['c']);
  });

  it('drops a card once it is remembered again', () => {
    expect(
      slippedCardIds(
        [
          { cardId: 'a', grade: 1, reviewedAt: new Date('2026-10-20T10:00:00.000Z') },
          { cardId: 'a', grade: 3, reviewedAt: new Date('2026-10-22T10:00:00.000Z') },
        ],
        10,
      ),
    ).toEqual([]);
  });

  it('looks back thirty days including today', () => {
    expect(slippedWindowStart('2026-10-29')).toBe('2026-09-30');
  });
});
