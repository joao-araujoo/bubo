import { type Database, schema } from '@bubo/database';
import { localClock } from '@bubo/domain';
import { and, eq, lte, sql } from 'drizzle-orm';

import { notifyReviewsDue } from './notifications';
import { type PushMessage } from './push';

const { readerPreferences, recallCards, reviewLogs } = schema;

/** Upper bound per run so one cron invocation stays well inside the Worker limits. */
const MAX_READERS_PER_RUN = 500;

/**
 * Hourly cron (ADR-022): readers who turned the review reminder on and whose local hour is their
 * chosen hour get one reminder per local day — only when cards are actually due.
 */
export async function runReviewReminders(db: Database, now: Date): Promise<PushMessage[]> {
  const candidates = await db
    .select({
      userId: readerPreferences.userId,
      reminderHour: readerPreferences.reminderHour,
      timeZone: readerPreferences.timeZone,
      lastReminderDate: readerPreferences.lastReminderDate,
      dailyReviewLimit: readerPreferences.dailyReviewLimit,
    })
    .from(readerPreferences)
    .where(
      and(
        eq(readerPreferences.reviewReminder, true),
        sql`EXTRACT(HOUR FROM ${now.toISOString()}::timestamptz AT TIME ZONE ${readerPreferences.timeZone}) = ${readerPreferences.reminderHour}`,
        sql`${readerPreferences.lastReminderDate} IS DISTINCT FROM (${now.toISOString()}::timestamptz AT TIME ZONE ${readerPreferences.timeZone})::date`,
      ),
    )
    .orderBy(sql`${readerPreferences.lastReminderDate} ASC NULLS FIRST`, readerPreferences.userId)
    .limit(MAX_READERS_PER_RUN);

  const messages: PushMessage[] = [];
  let handled = 0;
  for (const reader of candidates) {
    if (handled >= MAX_READERS_PER_RUN) break;
    const clock = localClock(now, reader.timeZone);
    if (!clock || clock.hour !== reader.reminderHour) continue;
    if (reader.lastReminderDate === clock.date) continue;
    handled += 1;
    // Atomic claim + inbox creation: overlapping jobs cannot duplicate a local day, and a
    // failed insert rolls back the claim so another invocation can safely try again.
    const notified = await db.transaction(async (tx) => {
      const claimed = await tx
        .update(readerPreferences)
        .set({ lastReminderDate: clock.date })
        .where(
          and(
            eq(readerPreferences.userId, reader.userId),
            eq(readerPreferences.reviewReminder, true),
            eq(readerPreferences.reminderHour, reader.reminderHour),
            eq(readerPreferences.timeZone, reader.timeZone),
            sql`${readerPreferences.lastReminderDate} IS DISTINCT FROM ${clock.date}::date`,
          ),
        )
        .returning({ dailyReviewLimit: readerPreferences.dailyReviewLimit });
      const claim = claimed[0];
      if (!claim) return [];
      const [due] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(recallCards)
        .where(and(eq(recallCards.userId, reader.userId), lte(recallCards.dueDate, clock.date)));
      const [reviewed] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(reviewLogs)
        .where(and(eq(reviewLogs.userId, reader.userId), eq(reviewLogs.localDate, clock.date)));
      const dueCount = Math.min(
        Number(due?.n ?? 0),
        Math.max(0, claim.dailyReviewLimit - Number(reviewed?.n ?? 0)),
      );
      return dueCount > 0
        ? notifyReviewsDue(tx, { userId: reader.userId, dueCount, localDate: clock.date }, now)
        : [];
    });
    messages.push(...notified);
  }
  return messages;
}
