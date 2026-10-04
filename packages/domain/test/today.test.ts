import { describe, expect, it } from 'vitest';

import {
  readingGapDays,
  selectTodayAction,
  type TodayData,
  type TodayDraft,
  type TodayReading,
} from '../src/today';

const ready = <T>(value: T): TodayData<T> => ({ state: 'ready', value });
const context = {
  today: '2026-10-04',
  draft: ready<TodayDraft | null>(null),
  readingEntryId: ready<string | null>('book'),
  reading: ready<TodayReading>({ readToday: false, lastReadingDate: '2026-10-03' }),
  reviewCount: ready(0),
};

describe('the primary action in Hoje', () => {
  it('protects a saved draft before reviews, absent books, server errors and loading', () => {
    expect(
      selectTodayAction({
        ...context,
        draft: ready({ shelfEntryId: 'saved-book', needsSave: true }),
        readingEntryId: { state: 'error' },
        reading: { state: 'loading' },
        reviewCount: ready(12),
      }),
    ).toEqual({ kind: 'recover', shelfEntryId: 'saved-book', needsSave: true });
  });

  it('waits for draft recovery and exposes failed recovery before allowing a new session', () => {
    expect(selectTodayAction({ ...context, draft: { state: 'loading' } })).toEqual({
      kind: 'loading',
    });
    expect(selectTodayAction({ ...context, draft: { state: 'error' } })).toEqual({
      kind: 'retry',
      source: 'draft',
    });
  });

  it.each(['readingEntryId', 'reading', 'reviewCount'] as const)(
    'never turns missing %s data into a successful empty result',
    (key) => {
      expect(selectTodayAction({ ...context, [key]: { state: 'loading' } })).toEqual({
        kind: 'loading',
      });
      expect(selectTodayAction({ ...context, [key]: { state: 'error' } })).toEqual({
        kind: 'retry',
        source: 'server',
      });
    },
  );

  it('offers only available reviews before return, continued reading or choosing a book', () => {
    for (const readingEntryId of [ready<string | null>('book'), ready<string | null>(null)]) {
      expect(
        selectTodayAction({
          ...context,
          readingEntryId,
          reading: ready({ readToday: false, lastReadingDate: '2026-01-01' }),
          reviewCount: ready(3),
        }),
      ).toEqual({ kind: 'review', count: 3 });
    }
    expect(
      selectTodayAction({
        ...context,
        reading: ready({ readToday: true, lastReadingDate: context.today }),
        reviewCount: ready(1),
      }),
    ).toEqual({ kind: 'review', count: 1 });
  });

  it('suggests five minutes after at least seven local calendar days without reading', () => {
    expect(
      selectTodayAction({
        ...context,
        reading: ready({ readToday: false, lastReadingDate: '2026-09-27' }),
      }),
    ).toEqual({ kind: 'return', shelfEntryId: 'book', awayDays: 7 });
    expect(
      selectTodayAction({
        ...context,
        reading: ready({ readToday: false, lastReadingDate: '2026-09-28' }),
      }),
    ).toEqual({ kind: 'read', shelfEntryId: 'book' });
  });

  it('does not invent absence for readers without a history or a recency field', () => {
    expect(
      selectTodayAction({
        ...context,
        reading: ready({ readToday: false, lastReadingDate: null }),
      }),
    ).toEqual({ kind: 'read', shelfEntryId: 'book' });
  });

  it('continues after a real session today, including a conflicting stale last-reading date', () => {
    expect(
      selectTodayAction({
        ...context,
        reading: ready({ readToday: true, lastReadingDate: '2026-01-01' }),
      }),
    ).toEqual({ kind: 'continue', shelfEntryId: 'book' });
  });

  it('chooses a book with no book in progress and no offered reviews', () => {
    expect(selectTodayAction({ ...context, readingEntryId: ready(null) })).toEqual({
      kind: 'choose',
    });
  });
});

describe('reading absence in local calendar days', () => {
  it('handles month/year/leap-year and daylight-saving boundaries as calendar dates', () => {
    expect(readingGapDays('2026-09-27', '2026-10-04')).toBe(7);
    expect(readingGapDays('2025-12-31', '2026-01-07')).toBe(7);
    expect(readingGapDays('2024-02-28', '2024-03-01')).toBe(2);
    expect(readingGapDays('2026-03-07', '2026-03-14')).toBe(7);
    expect(readingGapDays('2026-10-04', '2026-10-04')).toBe(0);
  });

  it('ignores missing, invalid and future dates without promising a return interval', () => {
    expect(readingGapDays(null, '2026-10-04')).toBeNull();
    expect(readingGapDays('2026-10-05', '2026-10-04')).toBeNull();
    expect(readingGapDays('2026-02-30', '2026-10-04')).toBeNull();
    expect(readingGapDays('2026-10-04', 'invalid')).toBeNull();
  });
});
