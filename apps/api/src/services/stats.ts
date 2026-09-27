import { type StatsResponse, statsResponseSchema } from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import { addDays, computeStreak, startOfWeek } from '@bubo/domain';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

const { readingSessions, recallCards, reviewLogs } = schema;

/** How far back streaks are computed (a longer streak is reported as this many days). */
const STREAK_LOOKBACK_DAYS = 400;

/**
 * Reader stats derived only from real activity (ADR-014):
 * XP = session XP + review XP; the week and the streak count days with a session OR a review.
 */
export async function getStats(
  db: Executor,
  userId: string,
  today: string,
): Promise<StatsResponse> {
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const lookback = addDays(today, -STREAK_LOOKBACK_DAYS);

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

  return statsResponseSchema.parse({
    today,
    xpTotal: Number(sessionTotals?.xp ?? 0) + Number(reviewTotals?.xp ?? 0),
    streakDays: computeStreak(
      [...activeDates].filter((d) => d <= today),
      today,
    ),
    sessionsCount: Number(sessionTotals?.count ?? 0),
    focusedMinutesThisWeek: Math.floor(Number(weekMinutes?.seconds ?? 0) / 60),
    weekActiveDates: [...activeDates].filter((d) => d >= weekStart && d <= weekEnd).sort(),
    readToday: readDates.has(today),
    reviewedToday: reviewDates.has(today),
    dueCards: Number(due?.count ?? 0),
  });
}
