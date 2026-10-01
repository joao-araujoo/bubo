import { describe, expect, it } from 'vitest';

import {
  ACHIEVEMENTS,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  canSeePollResults,
  dayPartOf,
  formatInviteCode,
  inviteCodeFromBytes,
  isPollOpen,
  normalizeInviteCode,
  pageBuckets,
  pollClosesAt,
  pollPercentages,
  recallStrength,
} from '../src';

describe('polls', () => {
  it('closes after the chosen number of days', () => {
    const created = new Date('2026-09-27T12:00:00.000Z');
    const closes = pollClosesAt(created, 3);
    expect(closes.toISOString()).toBe('2026-09-30T12:00:00.000Z');
    expect(isPollOpen(closes, new Date('2026-09-30T11:59:59.000Z'))).toBe(true);
    expect(isPollOpen(closes, closes)).toBe(false);
  });

  it('shows results only after voting, after closing or to the author', () => {
    const base = { hasVoted: false, isOpen: true, isAuthor: false };
    expect(canSeePollResults(base)).toBe(false);
    expect(canSeePollResults({ ...base, hasVoted: true })).toBe(true);
    expect(canSeePollResults({ ...base, isOpen: false })).toBe(true);
    expect(canSeePollResults({ ...base, isAuthor: true })).toBe(true);
  });

  it('rounds percentages to exactly 100 with the largest remainder', () => {
    expect(pollPercentages([233, 109])).toEqual([68, 32]);
    expect(pollPercentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(pollPercentages([0, 0])).toEqual([0, 0]);
    expect(pollPercentages([2, 1, 0, 0]).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('invite codes', () => {
  it('builds codes only from the unambiguous alphabet', () => {
    const code = inviteCodeFromBytes(new Uint8Array([0, 1, 2, 30, 31, 200, 255, 7]));
    expect(code).toHaveLength(INVITE_CODE_LENGTH);
    expect([...code].every((char) => INVITE_ALPHABET.includes(char))).toBe(true);
    expect(() => inviteCodeFromBytes(new Uint8Array(3))).toThrow();
  });

  it('normalizes typed codes and deep links, rejecting anything else', () => {
    expect(normalizeInviteCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(normalizeInviteCode('bubo://convite/ABCD2345')).toBe('ABCD2345');
    expect(normalizeInviteCode('ABCD 2345')).toBe('ABCD2345');
    expect(normalizeInviteCode('ABCD234')).toBeNull();
    expect(normalizeInviteCode('ABCD234O')).toBeNull();
    expect(normalizeInviteCode('')).toBeNull();
    expect(formatInviteCode('ABCD2345')).toBe('ABCD-2345');
  });
});

describe('pageBuckets', () => {
  it('splits the book in four ranges and counts members', () => {
    expect(pageBuckets(680, [0, 150, 462, 462, 600, 680])).toEqual([
      { from: 1, to: 170, count: 2 },
      { from: 171, to: 340, count: 0 },
      { from: 341, to: 510, count: 2 },
      { from: 511, to: 680, count: 2 },
    ]);
  });

  it('is empty without a usable page count', () => {
    expect(pageBuckets(null, [10])).toEqual([]);
    expect(pageBuckets(3, [1])).toEqual([]);
  });

  it('clamps pages beyond the book', () => {
    expect(pageBuckets(100, [500]).map((b) => b.count)).toEqual([0, 0, 0, 1]);
  });
});

describe('memory breakdowns', () => {
  it('maps local hours to day parts', () => {
    expect([0, 5, 6, 11, 12, 17, 18, 23].map(dayPartOf)).toEqual([
      'dawn',
      'dawn',
      'morning',
      'morning',
      'afternoon',
      'afternoon',
      'evening',
      'evening',
    ]);
  });

  it('labels recall strength only with enough attempts', () => {
    expect(recallStrength(2, 2)).toBe('unknown');
    expect(recallStrength(3, 4)).toBe('firm');
    expect(recallStrength(2, 4)).toBe('building');
    expect(recallStrength(1, 4)).toBe('fragile');
  });
});

describe('achievement tiers', () => {
  it('gives every badge a tier', () => {
    expect(
      ACHIEVEMENTS.every((a) => ['bronze', 'silver', 'gold', 'diamond'].includes(a.tier)),
    ).toBe(true);
  });
});
