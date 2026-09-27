import { describe, expect, it } from 'vitest';

import {
  addDays,
  applySessionToShelf,
  applyStatusChange,
  computeStreak,
  isIsoDate,
  startOfWeek,
  type ShelfState,
} from '../src';

const now = new Date('2026-09-26T20:00:00.000Z');
const base: ShelfState = {
  status: 'want_to_read',
  currentPage: 0,
  totalPages: 300,
  startedAt: null,
  finishedAt: null,
};

describe('ISO dates', () => {
  it('validates real calendar dates only', () => {
    expect(isIsoDate('2026-09-26')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('26/09/2026')).toBe(false);
  });

  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('finds the Monday of the week', () => {
    expect(startOfWeek('2026-09-26')).toBe('2026-09-21');
    expect(startOfWeek('2026-09-21')).toBe('2026-09-21');
    expect(startOfWeek('2026-09-27')).toBe('2026-09-21');
  });
});

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-09-24', '2026-09-25', '2026-09-26'], '2026-09-26')).toBe(3);
  });

  it('keeps yesterday’s streak alive until today ends', () => {
    expect(computeStreak(['2026-09-24', '2026-09-25'], '2026-09-26')).toBe(2);
  });

  it('breaks on a gap and is zero without activity', () => {
    expect(computeStreak(['2026-09-22', '2026-09-24', '2026-09-26'], '2026-09-26')).toBe(1);
    expect(computeStreak(['2026-09-23'], '2026-09-26')).toBe(0);
    expect(computeStreak([], '2026-09-26')).toBe(0);
  });
});

describe('applySessionToShelf', () => {
  it('starts reading and advances progress', () => {
    const next = applySessionToShelf(base, 42, now);
    expect(next).toMatchObject({
      status: 'reading',
      currentPage: 42,
      startedAt: now,
      finishedAt: null,
    });
  });

  it('never moves progress backwards', () => {
    const reading = { ...base, status: 'reading' as const, currentPage: 100, startedAt: now };
    expect(applySessionToShelf(reading, 60, now).currentPage).toBe(100);
  });

  it('finishes the book on the last page (clamped to the total)', () => {
    const next = applySessionToShelf({ ...base, currentPage: 280 }, 320, now);
    expect(next).toMatchObject({ status: 'finished', currentPage: 300, finishedAt: now });
  });

  it('works without a known page count', () => {
    const next = applySessionToShelf({ ...base, totalPages: null }, 50, now);
    expect(next).toMatchObject({ status: 'reading', currentPage: 50 });
  });
});

describe('applyStatusChange', () => {
  it('sets start/finish timestamps once', () => {
    const started = applyStatusChange(base, 'reading', now);
    expect(started.startedAt).toBe(now);
    const later = new Date('2026-10-01T00:00:00.000Z');
    const finished = applyStatusChange(started, 'finished', later);
    expect(finished).toMatchObject({ startedAt: now, finishedAt: later, currentPage: 300 });
    expect(applyStatusChange(finished, 'reading', later).finishedAt).toBeNull();
  });

  it('keeps timestamps untouched for "quero ler"', () => {
    expect(applyStatusChange(base, 'want_to_read', now)).toMatchObject({
      startedAt: null,
      finishedAt: null,
    });
  });
});
