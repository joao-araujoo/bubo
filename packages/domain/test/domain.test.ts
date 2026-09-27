import { describe, expect, it } from 'vitest';

import {
  buildCognitiveWeek,
  countActiveDays,
  err,
  ok,
  readingProgress,
  toLocalIsoDate,
} from '../src';

describe('readingProgress', () => {
  it('computes percent and pages left', () => {
    expect(readingProgress(126, 310)).toEqual({
      currentPage: 126,
      totalPages: 310,
      percent: 40,
      pagesLeft: 184,
    });
  });

  it('clamps pages beyond the total and below zero', () => {
    expect(readingProgress(400, 310).percent).toBe(100);
    expect(readingProgress(-5, 310).currentPage).toBe(0);
  });

  it('handles an unknown total page count', () => {
    expect(readingProgress(10, 0)).toEqual({
      currentPage: 0,
      totalPages: 0,
      percent: 0,
      pagesLeft: 0,
    });
    expect(readingProgress(10, Number.NaN).percent).toBe(0);
  });

  it('only reports 100% when finished', () => {
    expect(readingProgress(309, 310).percent).toBe(99);
  });
});

describe('buildCognitiveWeek', () => {
  // Friday, 25 September 2026 (local time)
  const friday = new Date(2026, 8, 25, 10, 30);

  it('returns Monday→Sunday with Portuguese labels', () => {
    const week = buildCognitiveWeek(friday);
    expect(week.map((d) => d.label)).toEqual(['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']);
    expect(week[0]?.isoDate).toBe('2026-09-21');
    expect(week[6]?.isoDate).toBe('2026-09-27');
  });

  it('marks past days as missed when there is no activity (no invented progress)', () => {
    const states = buildCognitiveWeek(friday).map((d) => d.state);
    expect(states).toEqual(['missed', 'missed', 'missed', 'missed', 'today', 'future', 'future']);
  });

  it('marks active days and today_done', () => {
    const week = buildCognitiveWeek(friday, new Set(['2026-09-21', '2026-09-25']));
    expect(week[0]?.state).toBe('done');
    expect(week[4]?.state).toBe('today_done');
    expect(countActiveDays(week)).toBe(2);
  });

  it('treats Sunday as the last day of the week', () => {
    const sunday = new Date(2026, 8, 27, 23, 0);
    const week = buildCognitiveWeek(sunday);
    expect(week[6]?.state).toBe('today');
    expect(week[0]?.isoDate).toBe('2026-09-21');
  });

  it('formats local dates with zero padding', () => {
    expect(toLocalIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('Result helpers', () => {
  it('builds tagged values', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('x')).toEqual({ ok: false, error: 'x' });
  });
});
