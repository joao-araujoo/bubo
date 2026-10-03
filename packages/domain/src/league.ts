import { addDays, startOfWeek } from './streak';

/**
 * Weekly friends league (ADR-029): ranks by real weekly XP. Ties go to the earlier name and then
 * the id, so every participant has a distinct, stable position.
 */
export function rankByXp<T extends { id: string; name: string }>(
  rows: readonly T[],
  xp: (row: T) => number,
): (T & { rank: number })[] {
  return [...rows]
    .sort(
      (a, b) =>
        xp(b) - xp(a) ||
        a.name.localeCompare(b.name, 'pt-BR') ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/** The league week (Monday→Sunday) of `today` and the days left in it, today included. */
export function leagueWeek(today: string) {
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  let daysLeft = 1;
  while (addDays(today, daysLeft) <= weekEnd) daysLeft += 1;
  return { weekStart, weekEnd, daysLeft };
}

/**
 * Standings with today's movement: `previousRank` ranks the same people by XP up to yesterday
 * (null on the first day of the week, when nobody had a position yet).
 */
export function buildLeagueStandings(input: {
  today: string;
  participants: readonly { id: string; name: string; me: boolean; xpBefore: number; xp: number }[];
}) {
  const week = leagueWeek(input.today);
  const ranked = rankByXp(input.participants, (row) => row.xp);
  const before = rankByXp(input.participants, (row) => row.xpBefore);
  const mine = ranked.find((row) => row.me);
  const previous = before.find((row) => row.me);
  if (!mine || !previous) throw new Error('The reader must be a participant of their league.');
  return {
    ...week,
    me: {
      rank: mine.rank,
      previousRank: input.today === week.weekStart ? null : previous.rank,
      weeklyXp: mine.xp,
    },
    entries: ranked.map((row) => ({
      rank: row.rank,
      name: row.name,
      weeklyXp: row.xp,
      me: row.me,
    })),
  };
}
