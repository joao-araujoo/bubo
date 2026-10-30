import { READING_MILESTONES, type ReadingMilestonePercent } from './home';
import { readingProgress } from './reading';

/**
 * Pure rules behind the redesigned reading flow (ADR-044): the book milestone a saved session
 * crossed (printed on the reading receipt) and the milestones of the streak screen. Real data in,
 * nothing invented out.
 */

/**
 * The highest quarter of the book (25/50/75/100 %) reached by moving from `startPage` to
 * `endPage` in one session, or null when none was crossed or the page count is unknown.
 */
export function crossedReadingMilestone(
  startPage: number,
  endPage: number,
  totalPages: number,
): ReadingMilestonePercent | null {
  const end = readingProgress(endPage, totalPages);
  if (end.totalPages === 0) return null;
  const start = readingProgress(startPage, totalPages).currentPage;
  let crossed: ReadingMilestonePercent | null = null;
  for (const percent of READING_MILESTONES) {
    const page = Math.ceil((end.totalPages * percent) / 100);
    if (start < page && end.currentPage >= page) crossed = percent;
  }
  return crossed;
}

/** Leaves drawn when the session has no goal of its own and the day's goal is unknown or met. */
export const DEFAULT_SESSION_TARGET_MINUTES = 10;

/**
 * Minutes the night timer draws as leaves (one per minute): the session's own goal ("5 min"),
 * else what is left of today's focus goal, else a default. Only a visual target: the timer never
 * stops or finishes by itself.
 */
export function sessionTargetMinutes(input: {
  goalSeconds?: number;
  dailyGoalMinutes: number | null;
  focusedMinutesToday: number | null;
}): number {
  if (input.goalSeconds && input.goalSeconds > 0) return Math.ceil(input.goalSeconds / 60);
  if (input.dailyGoalMinutes !== null && input.dailyGoalMinutes > 0) {
    if (input.focusedMinutesToday === null) return Math.ceil(input.dailyGoalMinutes);
    const left = Math.ceil(input.dailyGoalMinutes - Math.max(0, input.focusedMinutesToday));
    if (left > 0) return left;
  }
  return DEFAULT_SESSION_TARGET_MINUTES;
}

export const STREAK_MILESTONES = [7, 15, 30, 50, 100] as const;

export type StreakMilestone = {
  days: (typeof STREAK_MILESTONES)[number];
  /** `done`: reached by the current or the longest streak; `next`: the first one still ahead. */
  state: 'done' | 'next' | 'later';
  /** Days the current streak still needs (0 when done). */
  daysLeft: number;
};

export function streakMilestones(streakDays: number, longestStreakDays: number): StreakMilestone[] {
  const current = Math.max(0, Math.floor(streakDays || 0));
  const best = Math.max(current, Math.floor(longestStreakDays || 0));
  let nextTaken = false;
  return STREAK_MILESTONES.map((days) => {
    if (best >= days) return { days, state: 'done', daysLeft: 0 };
    const state = nextTaken ? 'later' : 'next';
    nextTaken = true;
    return { days, state, daysLeft: days - current };
  });
}
