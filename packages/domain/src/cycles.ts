/** Club reading cycles (Task 08): every number comes from recorded reading sessions. */

export const CYCLE_DURATIONS_DAYS = [7, 14, 30, 60, 90] as const;
export type CycleDurationDays = (typeof CYCLE_DURATIONS_DAYS)[number];

export type CycleTotals = {
  goalPages: number;
  participantCount: number;
  participantsAtGoal: number;
  totalPagesRead: number;
};

const DAY_MS = 86_400_000;

/** Share of the group goal (goal × participants) already read, 0–100, rounded down. */
export function cycleGroupPercent(cycle: CycleTotals): number {
  const target = cycle.goalPages * cycle.participantCount;
  if (target <= 0) return 0;
  return Math.min(100, Math.floor((cycle.totalPagesRead / target) * 100));
}

/** Whole days left until the end (0 once it ended); a partial day counts as one. */
export function cycleDaysLeft(endsAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / DAY_MS));
}

/** Length in whole weeks, at least 1 (Stitch "8 semanas"). */
export function cycleWeeks(startedAt: Date, endedAt: Date): number {
  return Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / (7 * DAY_MS)));
}

/**
 * Club history summary over closed cycles: how many, total pages read and the share of
 * participants who reached the goal (null when nobody took part yet).
 */
export function cycleHistorySummary(closed: readonly CycleTotals[]): {
  completed: number;
  pagesRead: number;
  goalRate: number | null;
} {
  const participants = closed.reduce((sum, cycle) => sum + cycle.participantCount, 0);
  const atGoal = closed.reduce((sum, cycle) => sum + cycle.participantsAtGoal, 0);
  return {
    completed: closed.length,
    pagesRead: closed.reduce((sum, cycle) => sum + cycle.totalPagesRead, 0),
    goalRate: participants === 0 ? null : Math.round((atGoal / participants) * 100),
  };
}
