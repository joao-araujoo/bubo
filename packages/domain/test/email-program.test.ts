import { describe, expect, it } from 'vitest';

import {
  EMAIL_CODE_LENGTH,
  isCompleteEmailCode,
  normalizeEmailCode,
  readingReturnDecision,
  wholeDaysBetween,
} from '../src';

const now = new Date('2026-10-12T13:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const eligible = {
  now,
  consent: true,
  hasReadingBook: true,
  lastSessionEndedAt: daysAgo(9),
  lastEmailAt: null,
  localHour: 10,
};

describe('e-mailed codes', () => {
  it('keeps digits only and caps the length', () => {
    expect(normalizeEmailCode(' 123 456 ')).toBe('123456');
    expect(normalizeEmailCode('12-34-56-78')).toBe('123456');
    expect(normalizeEmailCode('abc')).toBe('');
    expect(isCompleteEmailCode('12345')).toBe(false);
    expect(isCompleteEmailCode('123456')).toBe(true);
    expect(EMAIL_CODE_LENGTH).toBe(6);
  });
});

describe('reading-return e-mail', () => {
  it('counts whole days and never goes negative', () => {
    expect(wholeDaysBetween(daysAgo(7), now)).toBe(7);
    expect(wholeDaysBetween(new Date(now.getTime() - 1000), now)).toBe(0);
    expect(wholeDaysBetween(now, daysAgo(2))).toBe(0);
  });

  it('is eligible after seven days away, with consent, a current book and the local hour', () => {
    expect(readingReturnDecision(eligible)).toEqual({ eligible: true, daysAway: 9 });
    expect(readingReturnDecision({ ...eligible, lastSessionEndedAt: daysAgo(7) })).toEqual({
      eligible: true,
      daysAway: 7,
    });
  });

  it('never nudges without consent, a book, any reading or at another hour', () => {
    expect(readingReturnDecision({ ...eligible, consent: false })).toMatchObject({
      reason: 'no_consent',
    });
    expect(readingReturnDecision({ ...eligible, hasReadingBook: false })).toMatchObject({
      reason: 'no_reading_book',
    });
    expect(readingReturnDecision({ ...eligible, lastSessionEndedAt: null })).toMatchObject({
      reason: 'never_read',
    });
    expect(readingReturnDecision({ ...eligible, lastSessionEndedAt: daysAgo(6) })).toMatchObject({
      reason: 'read_recently',
    });
    expect(readingReturnDecision({ ...eligible, localHour: 9 })).toMatchObject({
      reason: 'wrong_hour',
    });
  });

  it('respects the thirty-day cooldown between e-mails', () => {
    expect(readingReturnDecision({ ...eligible, lastEmailAt: daysAgo(29) })).toMatchObject({
      reason: 'cooldown',
    });
    expect(readingReturnDecision({ ...eligible, lastEmailAt: daysAgo(30) })).toEqual({
      eligible: true,
      daysAway: 9,
    });
  });
});
