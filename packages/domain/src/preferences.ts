/** Reader preferences (Task 09). Every option changes real behaviour; nothing is decorative. */

export const REVIEW_INTENSITIES = ['gentle', 'balanced', 'intensive'] as const;
export type ReviewIntensity = (typeof REVIEW_INTENSITIES)[number];

/**
 * Multiplier applied to the SM-2 interval after a successful recall. "Suave" spaces reviews
 * further apart, "Intensivo" brings them closer; "Equilibrado" is plain SM-2.
 */
export const REVIEW_INTERVAL_FACTOR: Record<ReviewIntensity, number> = {
  gentle: 1.25,
  balanced: 1,
  intensive: 0.8,
};

export const DAILY_FOCUS_OPTIONS = [15, 20, 30, 45] as const;
export type DailyFocusMinutes = (typeof DAILY_FOCUS_OPTIONS)[number];

export const DAILY_REVIEW_LIMIT_MIN = 5;
export const DAILY_REVIEW_LIMIT_MAX = 50;
export const ANNUAL_BOOK_GOAL_MAX = 365;

export const DEFAULT_PREFERENCES = {
  reviewIntensity: 'balanced' as ReviewIntensity,
  dailyReviewLimit: 20,
  dailyFocusMinutes: 20 as DailyFocusMinutes,
  annualBookGoal: null as number | null,
  reviewReminder: false,
  reminderHour: 19,
  timeZone: 'America/Sao_Paulo',
  notifyCommunity: true,
  notifyFriends: true,
};

/** Interval after the reader's rigor. One-day steps (relearning, first review) never change. */
export function adjustInterval(intervalDays: number, intensity: ReviewIntensity): number {
  if (intervalDays <= 1) return Math.max(1, intervalDays);
  return Math.max(1, Math.round(intervalDays * REVIEW_INTERVAL_FACTOR[intensity]));
}

/** Cards still offered today under the daily limit (already graded ones count). */
export function remainingReviewsToday(limit: number, reviewedToday: number): number {
  return Math.max(0, limit - reviewedToday);
}

/** Validates an IANA time zone name ("America/Sao_Paulo"). */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

/** Calendar date (YYYY-MM-DD) and hour (0–23) at `now` in `timeZone`; null for unknown zones. */
export function localClock(now: Date, timeZone: string): { date: string; hour: number } | null {
  if (!isValidTimeZone(timeZone)) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(get('hour'));
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: hour === 24 ? 0 : hour };
}
