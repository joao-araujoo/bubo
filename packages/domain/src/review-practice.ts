import { addDays } from './streak';

/**
 * Pure rules behind the redesigned Revisar (ADR-045): when the daily card renews, the month
 * challenge and the "cards que escaparam" practice deck. Practice never grades, reschedules or
 * awards XP; every number here comes from recorded activity.
 */

/** Whole hours until the next local midnight (at least 1), for "renova em 9h". */
export function hoursUntilNextDay(now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 3_600_000));
}

/** Active days (reading or review) the month challenge asks for. */
export const MONTHLY_CHALLENGE_DAYS = 20;

export type MonthlyChallenge = {
  target: number;
  /** Distinct active days of this month up to today. */
  activeDays: number;
  daysInMonth: number;
  /** Days still able to count: the rest of the month, plus today while it has no activity. */
  available: number;
  completed: boolean;
  reachable: boolean;
};

export function monthlyChallenge(
  today: string,
  activeDates: Iterable<string>,
  target: number = MONTHLY_CHALLENGE_DAYS,
): MonthlyChallenge {
  const month = today.slice(0, 7);
  const active = new Set(
    [...activeDates].filter((date) => date.startsWith(month) && date <= today),
  );
  const [year, monthNumber] = today.split('-').map(Number) as [number, number];
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const day = Number(today.slice(8, 10));
  const available = daysInMonth - day + (active.has(today) ? 0 : 1);
  const completed = active.size >= target;
  return {
    target,
    activeDays: active.size,
    daysInMonth,
    available,
    completed,
    reachable: completed || active.size + available >= target,
  };
}

/** Grades below this were a lapse ("não lembrei" or a hard miss) in the SM-2 scale. */
export const LAPSE_GRADE_BELOW = 3;
/** Window of reviews that can put a card in the "escaparam" deck. */
export const SLIPPED_WINDOW_DAYS = 30;

/** First local date of the "escaparam" window ending on `today`. */
export function slippedWindowStart(today: string): string {
  return addDays(today, -(SLIPPED_WINDOW_DAYS - 1));
}

/**
 * Cards whose most recent graded attempt was a lapse, newest lapse first. A later good review
 * takes a card out of the deck.
 */
export function slippedCardIds(
  logs: readonly { cardId: string; grade: number; reviewedAt: Date | string }[],
  limit: number,
): string[] {
  const latest = new Map<string, { grade: number; at: number }>();
  for (const log of logs) {
    const at = new Date(log.reviewedAt).getTime();
    const previous = latest.get(log.cardId);
    if (!previous || at > previous.at) latest.set(log.cardId, { grade: log.grade, at });
  }
  return [...latest.entries()]
    .filter(([, value]) => value.grade < LAPSE_GRADE_BELOW)
    .sort((a, b) => b[1].at - a[1].at || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, limit))
    .map(([cardId]) => cardId);
}
