/**
 * XP rules. Deliberately small and explicit so product can tune them in one place; XP rewards
 * effortful recall more than raw reading volume ("read deeply", not "read more").
 */
export const XP_RULES = {
  perFocusedMinute: 1,
  maxFocusedMinutesPerSession: 60,
  perRecallAttempt: 2,
  perCorrectRecall: 3,
  reviewSessionCompleted: 25,
} as const;

export type ReadingSessionInput = { focusedMinutes: number };
export type RecallSessionInput = { attempts: number; correct: number; completed: boolean };

const wholeNonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function xpForReadingSession({ focusedMinutes }: ReadingSessionInput): number {
  const minutes = Math.min(wholeNonNegative(focusedMinutes), XP_RULES.maxFocusedMinutesPerSession);
  return minutes * XP_RULES.perFocusedMinute;
}

export function xpForRecallSession({ attempts, correct, completed }: RecallSessionInput): number {
  const tries = wholeNonNegative(attempts);
  const hits = Math.min(wholeNonNegative(correct), tries);
  return (
    tries * XP_RULES.perRecallAttempt +
    hits * XP_RULES.perCorrectRecall +
    (completed && tries > 0 ? XP_RULES.reviewSessionCompleted : 0)
  );
}
