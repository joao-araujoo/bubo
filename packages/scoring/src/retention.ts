/**
 * Retention estimate from the exponential forgetting curve R = e^(-t/S), where `t` is the time
 * since the last successful recall and `S` the memory stability (days). Returns 0..1.
 */
export function estimateRetention(daysSinceReview: number, stabilityDays: number): number {
  if (!Number.isFinite(daysSinceReview) || daysSinceReview <= 0) return 1;
  if (!Number.isFinite(stabilityDays) || stabilityDays <= 0) return 0;
  return Math.exp(-daysSinceReview / stabilityDays);
}

/** Recall quality, SM-2 style: 0 = blackout … 5 = perfect, effortless recall. */
export type RecallGrade = 0 | 1 | 2 | 3 | 4 | 5;

export type ReviewSchedule = {
  repetitions: number;
  intervalDays: number;
  easeFactor: number;
};

export const INITIAL_SCHEDULE: ReviewSchedule = {
  repetitions: 0,
  intervalDays: 0,
  easeFactor: 2.5,
};
export const MIN_EASE_FACTOR = 1.3;

/**
 * Spaced-repetition scheduling (SM-2). A grade below 3 resets the repetition streak so the card
 * comes back tomorrow; otherwise the interval grows by the ease factor.
 */
export function scheduleNextReview(previous: ReviewSchedule, grade: RecallGrade): ReviewSchedule {
  const rawEase = previous.easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  const easeFactor = Math.round(Math.max(MIN_EASE_FACTOR, rawEase) * 100) / 100;
  if (grade < 3) return { repetitions: 0, intervalDays: 1, easeFactor };

  const repetitions = previous.repetitions + 1;
  const intervalDays =
    repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(previous.intervalDays * easeFactor);
  return { repetitions, intervalDays, easeFactor };
}
