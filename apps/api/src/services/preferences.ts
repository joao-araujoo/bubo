import { type ReaderPreferences, readerPreferencesSchema } from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import { DEFAULT_PREFERENCES } from '@bubo/domain';
import { eq } from 'drizzle-orm';

const { readerPreferences } = schema;

/** The reader's preferences, or the defaults when they never saved any (no row is created). */
export async function getPreferences(db: Executor, userId: string): Promise<ReaderPreferences> {
  const [row] = await db
    .select()
    .from(readerPreferences)
    .where(eq(readerPreferences.userId, userId))
    .limit(1);
  return readerPreferencesSchema.parse(
    row
      ? {
          reviewIntensity: row.reviewIntensity,
          dailyReviewLimit: row.dailyReviewLimit,
          dailyFocusMinutes: row.dailyFocusMinutes,
          annualBookGoal: row.annualBookGoal,
          reviewReminder: row.reviewReminder,
          reminderHour: row.reminderHour,
          timeZone: row.timeZone,
          notifyCommunity: row.notifyCommunity,
          notifyFriends: row.notifyFriends,
        }
      : DEFAULT_PREFERENCES,
  );
}

/** Replaces every preference at once (PUT semantics, idempotent). */
export async function savePreferences(db: Executor, userId: string, input: ReaderPreferences) {
  await db
    .insert(readerPreferences)
    .values({ userId, ...input })
    .onConflictDoUpdate({ target: readerPreferences.userId, set: { ...input } });
  return getPreferences(db, userId);
}
