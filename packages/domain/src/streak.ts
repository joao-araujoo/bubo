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
