import { type Database, schema } from '@bubo/database';
import {
  DEFAULT_PREFERENCES,
  READING_RETURN_AFTER_DAYS,
  READING_RETURN_COOLDOWN_DAYS,
  READING_RETURN_LOCAL_HOUR,
  localClock,
  readingReturnDecision,
} from '@bubo/domain';
import { and, desc, eq, exists, gt, sql } from 'drizzle-orm';

import { type Logger } from '../lib/logger';
import { createUnsubscribeToken, unsubscribeUrl } from './email-consent';
import { type EmailSender } from './email';

const { users, readerPreferences, readerEmailEvents, shelfEntries, books, readingSessions } =
  schema;

/** Upper bound per hourly run so one invocation stays well inside the Worker limits. */
const MAX_READERS_PER_RUN = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
export const READING_RETURN_KIND = 'reading_return';

export type ReadingReturnDeps = {
  email: Pick<EmailSender, 'canDeliver' | 'sendReadingReturn'>;
  /** Signs the opt-out links (the auth secret). */
  secret: string;
  /** Public API origin for the opt-out links (BETTER_AUTH_URL). */
  baseUrl: string;
  logger: Logger;
};

/**
 * Hourly cron (ADR-038): readers who consented, have a book in progress, read at least once, have
 * not read for seven or more days and were not e-mailed in the last thirty days get one "sentimos
 * sua falta" e-mail at ten in the morning of their own time zone. Every rule is checked twice:
 * in SQL to find candidates and in `readingReturnDecision` before sending.
 */
export async function runReadingReturnEmails(
  db: Database,
  now: Date,
  deps: ReadingReturnDeps,
): Promise<{ candidates: number; sent: number }> {
  if (!deps.email.canDeliver) return { candidates: 0, sent: 0 };
  const awayCutoff = new Date(now.getTime() - READING_RETURN_AFTER_DAYS * DAY_MS).toISOString();
  const cooldownCutoff = new Date(
    now.getTime() - READING_RETURN_COOLDOWN_DAYS * DAY_MS,
  ).toISOString();
  const nowIso = now.toISOString();

  const lastSession = db
    .select({
      userId: readingSessions.userId,
      endedAt: sql<Date>`max(${readingSessions.endedAt})`.as('last_ended_at'),
    })
    .from(readingSessions)
    .groupBy(readingSessions.userId)
    .as('last_session');
  const lastEmail = db
    .select({
      userId: readerEmailEvents.userId,
      sentAt: sql<Date>`max(${readerEmailEvents.createdAt})`.as('last_sent_at'),
    })
    .from(readerEmailEvents)
    .where(eq(readerEmailEvents.kind, READING_RETURN_KIND))
    .groupBy(readerEmailEvents.userId)
    .as('last_email');
  const timeZone = sql<string>`coalesce(${readerPreferences.timeZone}, ${DEFAULT_PREFERENCES.timeZone})`;
  const consent = sql<boolean>`coalesce(${readerPreferences.emailReadingReminders}, true)`;

  const candidates = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      timeZone,
      consent,
      lastSessionAt: lastSession.endedAt,
      lastEmailAt: lastEmail.sentAt,
    })
    .from(users)
    .innerJoin(lastSession, eq(lastSession.userId, users.id))
    .leftJoin(readerPreferences, eq(readerPreferences.userId, users.id))
    .leftJoin(lastEmail, eq(lastEmail.userId, users.id))
    .where(
      and(
        sql`${consent} IS TRUE`,
        sql`${lastSession.endedAt} <= ${awayCutoff}::timestamptz`,
        sql`(${lastEmail.sentAt} IS NULL OR ${lastEmail.sentAt} <= ${cooldownCutoff}::timestamptz)`,
        sql`EXTRACT(HOUR FROM ${nowIso}::timestamptz AT TIME ZONE ${timeZone}) = ${READING_RETURN_LOCAL_HOUR}`,
        exists(
          db
            .select({ id: shelfEntries.id })
            .from(shelfEntries)
            .where(and(eq(shelfEntries.userId, users.id), eq(shelfEntries.status, 'reading'))),
        ),
      ),
    )
    .orderBy(users.id)
    .limit(MAX_READERS_PER_RUN);

  let sent = 0;
  for (const reader of candidates) {
    const clock = localClock(now, reader.timeZone);
    const decision = readingReturnDecision({
      now,
      consent: reader.consent === true,
      hasReadingBook: true,
      lastSessionEndedAt: reader.lastSessionAt ? new Date(reader.lastSessionAt) : null,
      lastEmailAt: reader.lastEmailAt ? new Date(reader.lastEmailAt) : null,
      localHour: clock?.hour ?? -1,
    });
    if (!decision.eligible || !clock) continue;

    const [current] = await db
      .select({
        entryId: shelfEntries.id,
        currentPage: shelfEntries.currentPage,
        entryPages: shelfEntries.totalPages,
        bookPages: books.totalPages,
        title: books.title,
      })
      .from(shelfEntries)
      .innerJoin(books, eq(books.id, shelfEntries.bookId))
      .where(and(eq(shelfEntries.userId, reader.userId), eq(shelfEntries.status, 'reading')))
      .orderBy(desc(shelfEntries.updatedAt))
      .limit(1);
    if (!current) continue;

    // Claim first (overlapping runs see the row); the provider idempotency key covers the rest.
    const claimId = await db.transaction(async (tx) => {
      const [recent] = await tx
        .select({ id: readerEmailEvents.id })
        .from(readerEmailEvents)
        .where(
          and(
            eq(readerEmailEvents.userId, reader.userId),
            eq(readerEmailEvents.kind, READING_RETURN_KIND),
            gt(readerEmailEvents.createdAt, new Date(cooldownCutoff)),
          ),
        )
        .limit(1);
      if (recent) return null;
      const id = crypto.randomUUID();
      await tx
        .insert(readerEmailEvents)
        .values({ id, userId: reader.userId, kind: READING_RETURN_KIND, createdAt: now });
      return id;
    });
    if (!claimId) continue;

    try {
      const token = await createUnsubscribeToken(deps.secret, reader.userId);
      await deps.email.sendReadingReturn({
        to: reader.email,
        name: reader.name,
        bookTitle: current.title,
        currentPage: current.currentPage,
        totalPages: current.entryPages ?? current.bookPages ?? null,
        daysAway: decision.daysAway,
        bookUrl: `bubo:///livro/${encodeURIComponent(current.entryId)}`,
        unsubscribeUrl: unsubscribeUrl(deps.baseUrl, token),
        // Same reader + same local day → the provider deduplicates even if the claim is retried.
        eventId: `${reader.userId}:${clock.date}`,
      });
      sent += 1;
    } catch (error) {
      // Release the claim so the next hour can try again; ids only, never the address.
      await db.delete(readerEmailEvents).where(eq(readerEmailEvents.id, claimId));
      deps.logger.warn('reading return email failed', {
        userId: reader.userId,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
  return { candidates: candidates.length, sent };
}
