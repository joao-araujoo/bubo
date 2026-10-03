import { type StatsResponse, statsResponseSchema } from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import { addDays, computeStreakState, startOfWeek, STREAK_FREEZE_RULES } from '@bubo/domain';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

const { readingSessions, recallCards, reviewLogs } = schema;

/** How far back streaks are computed (a longer streak is reported as this many days). */
const STREAK_LOOKBACK_DAYS = 400;

/**
 * Reader stats derived only from real activity (ADR-014):
 * XP = session XP + review XP; the week and the streak count days with a session OR a review.
 * Missed days covered by an earned protection keep the streak alive (ADR-029).
 */
export async function getStats(
  db: Executor,
  userId: string,
  today: string,
): Promise<StatsResponse> {
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const monthStart = `${today.slice(0, 8)}01`;
  // Protection is replayed from its start date, so that window is always included (ADR-029).
  const windowStart = addDays(today, -STREAK_LOOKBACK_DAYS);
  const lookback =
    windowStart < STREAK_FREEZE_RULES.since ? windowStart : STREAK_FREEZE_RULES.since;

  const [sessionTotals] = await db
    .select({
      xp: sql<number>`coalesce(sum(${readingSessions.xpEarned}), 0)::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(readingSessions)
    .where(eq(readingSessions.userId, userId));

  const [reviewTotals] = await db
    .select({ xp: sql<number>`coalesce(sum(${reviewLogs.xpEarned}), 0)::int` })
    .from(reviewLogs)
    .where(eq(reviewLogs.userId, userId));

  const [weekMinutes] = await db
    .select({ seconds: sql<number>`coalesce(sum(${readingSessions.focusedSeconds}), 0)::int` })
    .from(readingSessions)
    .where(
      and(
        eq(readingSessions.userId, userId),
        gte(readingSessions.localDate, weekStart),
        lte(readingSessions.localDate, weekEnd),
      ),
    );

  const [todayMinutes] = await db
    .select({ seconds: sql<number>`coalesce(sum(${readingSessions.focusedSeconds}), 0)::int` })
    .from(readingSessions)
    .where(and(eq(readingSessions.userId, userId), eq(readingSessions.localDate, today)));

  const sessionDays = await db
    .selectDistinct({ localDate: readingSessions.localDate })
    .from(readingSessions)
    .where(
      and(
        eq(readingSessions.userId, userId),
        gte(readingSessions.localDate, lookback),
        lte(readingSessions.localDate, weekEnd),
      ),
    );
  const reviewDays = await db
    .selectDistinct({ localDate: reviewLogs.localDate })
    .from(reviewLogs)
    .where(
      and(
        eq(reviewLogs.userId, userId),
        gte(reviewLogs.localDate, lookback),
        lte(reviewLogs.localDate, weekEnd),
      ),
    );

  const [due] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recallCards)
    .where(and(eq(recallCards.userId, userId), lte(recallCards.dueDate, today)));

  const readDates = new Set(sessionDays.map((d) => d.localDate));
  const reviewDates = new Set(reviewDays.map((d) => d.localDate));
  const activeDates = new Set([...readDates, ...reviewDates]);
  const streak = computeStreakState(activeDates, today);
  const visibleFrom = weekStart < monthStart ? weekStart : monthStart;

  return statsResponseSchema.parse({
    today,
    xpTotal: Number(sessionTotals?.xp ?? 0) + Number(reviewTotals?.xp ?? 0),
    streakDays: streak.streakDays,
    sessionsCount: Number(sessionTotals?.count ?? 0),
    focusedMinutesThisWeek: Math.floor(Number(weekMinutes?.seconds ?? 0) / 60),
    focusedMinutesToday: Math.floor(Number(todayMinutes?.seconds ?? 0) / 60),
    weekActiveDates: [...activeDates].filter((d) => d >= weekStart && d <= weekEnd).sort(),
    monthActiveDates: [...activeDates].filter((d) => d >= monthStart && d <= today).sort(),
    weekReadingDates: [...readDates].filter((d) => d >= weekStart && d <= weekEnd).sort(),
    readToday: readDates.has(today),
    reviewedToday: reviewDates.has(today),
    dueCards: Number(due?.count ?? 0),
    streakFreeze: {
      available: streak.freezesAvailable,
      max: STREAK_FREEZE_RULES.max,
      earnEvery: STREAK_FREEZE_RULES.earnEvery,
      progress: streak.freezeProgress,
      frozenDates: streak.frozenDates.filter((d) => d >= visibleFrom),
    },
  });
}
