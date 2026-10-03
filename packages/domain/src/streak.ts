/** Local calendar dates are exchanged as `YYYY-MM-DD` strings (the reader's own time zone). */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return (
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d)
  );
}

/** Adds (or subtracts) whole days to a `YYYY-MM-DD` date. */
export function addDays(isoDate: string, days: number): string {
  const match = ISO_DATE.exec(isoDate);
  if (!match || !isIsoDate(isoDate)) throw new Error(`Invalid ISO date: ${isoDate}`);
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + days));
  return date.toISOString().slice(0, 10);
}

/** Monday of the week containing `isoDate`. */
export function startOfWeek(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate);
  if (!match || !isIsoDate(isoDate)) throw new Error(`Invalid ISO date: ${isoDate}`);
  const [, y, m, d] = match;
  const weekday = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay();
  return addDays(isoDate, -((weekday + 6) % 7));
}

/**
 * Consecutive active days ending today — or ending yesterday when today has no activity yet
 * (the streak is still alive until the day is over).
 */
export function computeStreak(activeDates: Iterable<string>, today: string): number {
  const days = new Set(activeDates);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * Streak protection ("proteção", ADR-029), derived only from real activity (ADR-014):
 * every `earnEvery` active days inside the current streak earn one protection, up to `max`.
 * A closed day (before today) without activity consumes one protection automatically and the
 * streak survives; without protection left the streak breaks. Frozen days never add to the
 * count. Only days from `since` on are evaluated, so the rule is never applied retroactively.
 */
export const STREAK_FREEZE_RULES = { since: '2026-10-03', earnEvery: 7, max: 2 } as const;

export type StreakFreezeRules = { since: string; earnEvery: number; max: number };

export type StreakState = {
  /** Active days in the current chain of active or protected days. */
  streakDays: number;
  /** Closed days covered by a protection, ascending. */
  frozenDates: string[];
  /** Protections ready to cover the next missed day. */
  freezesAvailable: number;
  /** Active days already counted toward the next protection (0 … earnEvery − 1). */
  freezeProgress: number;
};

export function computeStreakState(
  activeDates: Iterable<string>,
  today: string,
  rules: StreakFreezeRules = STREAK_FREEZE_RULES,
): StreakState {
  const days = new Set([...activeDates].filter((date) => date <= today));
  const frozen = new Set<string>();
  let available = 0;
  let progress = 0;
  for (let day = rules.since; day <= today; day = addDays(day, 1)) {
    if (days.has(day)) {
      progress += 1;
      if (progress >= rules.earnEvery) {
        progress = 0;
        available = Math.min(rules.max, available + 1);
      }
    } else if (day < today) {
      if (available > 0) {
        available -= 1;
        frozen.add(day);
      } else {
        progress = 0;
      }
    }
  }
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor) || frozen.has(cursor)) {
    if (days.has(cursor)) streak += 1;
    cursor = addDays(cursor, -1);
  }
  return {
    streakDays: streak,
    frozenDates: [...frozen].sort(),
    freezesAvailable: available,
    freezeProgress: progress,
  };
}
