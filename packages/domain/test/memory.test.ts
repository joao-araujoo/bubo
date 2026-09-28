import { describe, expect, it } from 'vitest';

import {
  buildMemoryPath,
  type MemoryPathSession,
  reviewOutcome,
  summarizeMemoryDays,
} from '../src';

const session = (id: string, localDate: string, endedAt: string): MemoryPathSession => ({
  id,
  localDate,
  endedAt,
  startPage: 10,
  endPage: 30,
  pagesRead: 20,
  focusedSeconds: 1500,
});

describe('reviewOutcome', () => {
  it('matches the Lembrei / Quase / Esqueci split', () => {
    expect([0, 1, 2, 3, 4, 5].map(reviewOutcome)).toEqual([
      'forgot',
      'forgot',
      'forgot',
      'almost',
      'remembered',
      'remembered',
    ]);
  });
});

describe('buildMemoryPath', () => {
  it('is empty without any recorded activity or cards', () => {
    expect(
      buildMemoryPath({ today: '2026-09-27', sessions: [], reviews: [], cardDueDates: [] }),
    ).toEqual([]);
  });

  it('orders sessions and reviews chronologically, including within a day', () => {
    const steps = buildMemoryPath({
      today: '2026-09-27',
      sessions: [
        session('s2', '2026-09-26', '2026-09-26T22:00:00.000Z'),
        session('s1', '2026-09-24', '2026-09-24T10:00:00.000Z'),
      ],
      reviews: [
        { id: 'r1', localDate: '2026-09-26', reviewedAt: '2026-09-26T08:00:00.000Z', grade: 3 },
      ],
      cardDueDates: [],
    });
    expect(steps.map((step) => (step.kind === 'next' ? 'next' : step.id))).toEqual([
      's1',
      'r1',
      's2',
    ]);
    expect(steps[1]).toMatchObject({ kind: 'review', outcome: 'almost' });
    expect(steps[0]).toMatchObject({ kind: 'reading', at: '2026-09-24T10:00:00.000Z' });
  });

  it('orders by local date before timestamps (time zones)', () => {
    const steps = buildMemoryPath({
      today: '2026-09-27',
      sessions: [session('late', '2026-09-26', '2026-09-27T01:00:00.000Z')],
      reviews: [
        { id: 'early', localDate: '2026-09-27', reviewedAt: '2026-09-27T00:30:00.000Z', grade: 4 },
      ],
      cardDueDates: [],
    });
    expect(steps.map((step) => (step.kind === 'next' ? 'next' : step.id))).toEqual([
      'late',
      'early',
    ]);
  });

  it('keeps only the most recent past steps', () => {
    const sessions = Array.from({ length: 12 }, (_, index) => {
      const day = String(index + 1).padStart(2, '0');
      return session(`s${index + 1}`, `2026-09-${day}`, `2026-09-${day}T12:00:00.000Z`);
    });
    const steps = buildMemoryPath({
      today: '2026-09-27',
      sessions,
      reviews: [],
      cardDueDates: [],
      maxPast: 3,
    });
    expect(steps.map((step) => (step.kind === 'next' ? 'next' : step.id))).toEqual([
      's10',
      's11',
      's12',
    ]);
  });

  it('ends with the reviews due today, counting overdue cards', () => {
    const steps = buildMemoryPath({
      today: '2026-09-27',
      sessions: [],
      reviews: [],
      cardDueDates: ['2026-09-25', '2026-09-27', '2026-10-02'],
    });
    expect(steps).toEqual([{ kind: 'next', localDate: '2026-09-27', isDue: true, cardCount: 2 }]);
  });

  it('ends with the earliest upcoming review when nothing is due', () => {
    const steps = buildMemoryPath({
      today: '2026-09-27',
      sessions: [],
      reviews: [],
      cardDueDates: ['2026-10-05', '2026-09-30', '2026-09-30'],
    });
    expect(steps).toEqual([{ kind: 'next', localDate: '2026-09-30', isDue: false, cardCount: 2 }]);
  });
});

describe('summarizeMemoryDays', () => {
  it('reports no percentage without attempts', () => {
    expect(
      summarizeMemoryDays([{ date: '2026-09-27', remembered: 0, almost: 0, forgot: 0 }]),
    ).toEqual({
      total: 0,
      remembered: 0,
      almost: 0,
      forgot: 0,
      activeDays: 0,
      rememberedPercent: null,
      busiestDay: 0,
    });
  });

  it('adds up recorded self-assessments', () => {
    expect(
      summarizeMemoryDays([
        { date: '2026-09-25', remembered: 2, almost: 1, forgot: 0 },
        { date: '2026-09-26', remembered: 0, almost: 0, forgot: 0 },
        { date: '2026-09-27', remembered: 0, almost: 1, forgot: 2 },
      ]),
    ).toEqual({
      total: 6,
      remembered: 2,
      almost: 2,
      forgot: 2,
      activeDays: 2,
      rememberedPercent: 33,
      busiestDay: 3,
    });
  });
});
