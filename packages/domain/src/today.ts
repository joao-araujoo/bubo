import { isIsoDate } from './streak';

export const READING_RETURN_AFTER_DAYS = 7;

/** Unknown data never becomes an invented empty shelf or a zero review queue. */
export type TodayData<T> = { state: 'loading' } | { state: 'error' } | { state: 'ready'; value: T };

export type TodayDraft = { shelfEntryId: string; needsSave: boolean };
export type TodayReading = {
  readToday: boolean;
  lastReadingDate: string | null;
};

export type TodayAction =
  | { kind: 'recover'; shelfEntryId: string; needsSave: boolean }
  | { kind: 'loading' }
  | { kind: 'retry'; source: 'draft' | 'server' }
  | { kind: 'review'; count: number }
  | { kind: 'return'; shelfEntryId: string; awayDays: number }
  | { kind: 'continue'; shelfEntryId: string }
  | { kind: 'read'; shelfEntryId: string }
  | { kind: 'choose' };

/** Calendar days, independent of DST or the execution machine's time zone. */
export function readingGapDays(lastReadingDate: string | null, today: string): number | null {
  if (
    lastReadingDate === null ||
    !isIsoDate(lastReadingDate) ||
    !isIsoDate(today) ||
    lastReadingDate > today
  )
    return null;
  return (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${lastReadingDate}T00:00:00Z`)) / 86400000;
}

/**
 * One primary action: protect the local draft, resolve missing data, review an offered card,
 * return gently after a week away, then read. Daily review limits are already reflected in
 * `reviewCount` (the offered queue length), never in the unbounded total of overdue cards.
 */
export function selectTodayAction({
  today,
  draft,
  readingEntryId,
  reading,
  reviewCount,
}: {
  today: string;
  draft: TodayData<TodayDraft | null>;
  readingEntryId: TodayData<string | null>;
  reading: TodayData<TodayReading>;
  reviewCount: TodayData<number>;
}): TodayAction {
  if (draft.state === 'loading') return { kind: 'loading' };
  if (draft.state === 'error') return { kind: 'retry', source: 'draft' };
  if (draft.value) return { kind: 'recover', ...draft.value };

  if (
    readingEntryId.state === 'error' ||
    reading.state === 'error' ||
    reviewCount.state === 'error'
  )
    return { kind: 'retry', source: 'server' };
  if (
    readingEntryId.state !== 'ready' ||
    reading.state !== 'ready' ||
    reviewCount.state !== 'ready'
  )
    return { kind: 'loading' };

  if (reviewCount.value > 0) return { kind: 'review', count: reviewCount.value };
  if (readingEntryId.value === null) return { kind: 'choose' };

  const shelfEntryId = readingEntryId.value;
  if (reading.value.readToday) return { kind: 'continue', shelfEntryId };
  const awayDays = readingGapDays(reading.value.lastReadingDate, today);
  if (awayDays !== null && awayDays >= READING_RETURN_AFTER_DAYS)
    return { kind: 'return', shelfEntryId, awayDays };
  return { kind: 'read', shelfEntryId };
}
