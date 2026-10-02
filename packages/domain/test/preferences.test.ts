import { describe, expect, it } from 'vitest';

import { adjustInterval, isValidTimeZone, localClock, remainingReviewsToday } from '../src';

describe('reader preferences', () => {
  it('scales successful intervals by rigor and never touches one-day steps', () => {
    expect(adjustInterval(6, 'balanced')).toBe(6);
    expect(adjustInterval(6, 'gentle')).toBe(8);
    expect(adjustInterval(6, 'intensive')).toBe(5);
    expect(adjustInterval(2, 'intensive')).toBe(2);
    expect(adjustInterval(1, 'gentle')).toBe(1);
    expect(adjustInterval(0, 'intensive')).toBe(1);
  });

  it('counts the cards left under the daily limit', () => {
    expect(remainingReviewsToday(20, 0)).toBe(20);
    expect(remainingReviewsToday(20, 8)).toBe(12);
    expect(remainingReviewsToday(5, 9)).toBe(0);
  });

  it('reads the local date and hour of a time zone', () => {
    const now = new Date('2026-09-30T23:30:00Z');
    expect(localClock(now, 'America/Sao_Paulo')).toEqual({ date: '2026-09-30', hour: 20 });
    expect(localClock(now, 'Asia/Tokyo')).toEqual({ date: '2026-10-01', hour: 8 });
    expect(localClock(new Date('2026-10-01T03:05:00Z'), 'America/Sao_Paulo')).toEqual({
      date: '2026-10-01',
      hour: 0,
    });
    expect(localClock(now, 'Nowhere/Invalid')).toBeNull();
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('')).toBe(false);
  });
});
