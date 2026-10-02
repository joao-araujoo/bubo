import { type Database, schema } from '@bubo/database';
import { localClock } from '@bubo/domain';
import { and, eq, lte, sql } from 'drizzle-orm';

import { notifyReviewsDue } from './notifications';
import { type PushMessage } from './push';

const { readerPreferences, recallCards } = schema;

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
    })
    .from(readerPreferences)
    .where(eq(readerPreferences.reviewReminder, true))
    .limit(5000);

  const messages: PushMessage[] = [];
  let handled = 0;
  for (const reader of candidates) {
    if (handled >= MAX_READERS_PER_RUN) break;
    const clock = localClock(now, reader.timeZone);
    if (!clock || clock.hour !== reader.reminderHour) continue;
    if (reader.lastReminderDate === clock.date) continue;
    handled += 1;
    const [due] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(recallCards)
      .where(and(eq(recallCards.userId, reader.userId), lte(recallCards.dueDate, clock.date)));
    // Marked even when nothing is due, so the reader is checked once per local day.
    await db
      .update(readerPreferences)
      .set({ lastReminderDate: clock.date })
      .where(eq(readerPreferences.userId, reader.userId));
    const dueCount = Number(due?.n ?? 0);
    if (dueCount > 0) {
      messages.push(...(await notifyReviewsDue(db, { userId: reader.userId, dueCount }, now)));
    }
  }
  return messages;
}
