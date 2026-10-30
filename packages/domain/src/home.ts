import { readingProgress } from './reading';

/**
 * Pure rules behind the redesigned Hoje (ADR-043): the greeting for the local hour, the next
 * reading milestone of the current book and the stamps of the daily card. Every value comes from
 * real reading data; nothing here invents progress.
 */

export type GreetingPeriod = 'morning' | 'afternoon' | 'night';

/** Local hour (0–23) → part of the day. Nights run from 18:00 to 04:59. */
export function greetingPeriod(hour: number): GreetingPeriod {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
}

export const GREETING_BY_PERIOD: Record<GreetingPeriod, string> = {
  morning: 'Bom dia',
  afternoon: 'Boa tarde',
  night: 'Boa noite',
};

export const READING_MILESTONES = [25, 50, 75, 100] as const;
export type ReadingMilestonePercent = (typeof READING_MILESTONES)[number];

export type ReadingMilestone = {
  percent: ReadingMilestonePercent;
  /** First page at which the milestone counts as reached. */
  page: number;
  pagesLeft: number;
};

/**
 * The next quarter of the book the reader has not reached yet, or null when the page count is
 * unknown or the book is finished.
 */
export function nextReadingMilestone(
  currentPage: number,
  totalPages: number,
): ReadingMilestone | null {
  const progress = readingProgress(currentPage, totalPages);
  if (progress.totalPages === 0) return null;
  for (const percent of READING_MILESTONES) {
    const page = Math.ceil((progress.totalPages * percent) / 100);
    if (progress.currentPage < page) {
      return { percent, page, pagesLeft: page - progress.currentPage };
    }
  }
  return null;
}

export type DailyStampId = 'focus' | 'recall' | 'review';
export type DailyStamp = { id: DailyStampId; label: string; done: boolean };

/**
 * The daily card: one stamp per real habit of the day. A session only counts after its recall
 * exercise passes (ADR-027), so a session today is also the recall stamp. The review stamp only
 * exists when there is something to review or the reader already reviewed today.
 */
export function dailyStamps(input: {
  focusedMinutesToday: number;
  /** Daily focus goal from Preferências; null when unknown. */
  goalMinutes: number | null;
  readToday: boolean;
  reviewedToday: boolean;
  dueCards: number;
}): DailyStamp[] {
  const stamps: DailyStamp[] = [
    input.goalMinutes === null
      ? { id: 'focus', label: 'Ler hoje', done: input.readToday }
      : {
          id: 'focus',
          label: `Ler ${input.goalMinutes} min`,
          done: input.focusedMinutesToday >= input.goalMinutes,
        },
    { id: 'recall', label: 'Lembrar sem espiar', done: input.readToday },
  ];
  if (input.reviewedToday || input.dueCards > 0) {
    stamps.push({ id: 'review', label: 'Revisar cards', done: input.reviewedToday });
  }
  return stamps;
}
