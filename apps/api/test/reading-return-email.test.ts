import { schema } from '@bubo/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLogger } from '../src/lib/logger';
import { runScheduled } from '../src/scheduled';
import { runReadingReturnEmails } from '../src/services/reading-return-email';
import { createEmailRecorder } from './email-recorder';
import { createHarness, TEST_SECRET } from './harness';

/**
 * ADR-038: "sentimos sua falta" goes out at 10:00 local time to readers who consented, have a
 * book in progress, read at least once, have not read for seven days and were not e-mailed in the
 * last thirty. 13:00Z is 10:00 in America/Sao_Paulo (the default zone).
 */
let h: Awaited<ReturnType<typeof createHarness>>;
const recorder = createEmailRecorder();
const logger = createLogger({}, () => undefined);
const TEN_LOCAL = new Date('2026-10-12T13:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
let counter = 0;

beforeAll(async () => {
  h = await createHarness({ emailSender: () => recorder.sender });
}, 60_000);
afterAll(async () => {
  await h.close();
});

const deps = () => ({
  email: recorder.sender,
  secret: TEST_SECRET,
  baseUrl: 'https://api.bubo.example',
  logger,
});

async function reader(options: {
  daysSinceReading: number | null;
  status?: 'reading' | 'finished';
  currentPage?: number;
  totalPages?: number | null;
  consent?: boolean;
}) {
  counter += 1;
  const email = `retorno${counter}@example.test`;
  const signUp = await h.call('/v1/auth/sign-up/email', {
    method: 'POST',
    ip: `10.7.0.${counter}`,
    json: { name: 'Ana Leitora', email, password: 'senha-forte-123' },
  });
  expect(signUp.status).toBe(200);
  const cookie =
    signUp.headers
      .getSetCookie()
      .find((value) => value.startsWith('better-auth.session_token='))
      ?.split(';')[0] ?? '';
  const me = (await (await h.call('/v1/me', { cookie })).json()) as { user: { id: string } };
  const userId = me.user.id;
  const { db } = h.database;
  const bookId = `book-${counter}`;
  const entryId = `entry-${counter}`;
  await db.insert(schema.books).values({ id: bookId, title: 'Duna', totalPages: 680 });
  await db.insert(schema.shelfEntries).values({
    id: entryId,
    userId,
    bookId,
    status: options.status ?? 'reading',
    currentPage: options.currentPage ?? 142,
    ...(options.totalPages !== undefined ? { totalPages: options.totalPages } : {}),
  });
  if (options.daysSinceReading !== null) {
    const endedAt = new Date(TEN_LOCAL.getTime() - options.daysSinceReading * DAY);
    await db.insert(schema.readingSessions).values({
      id: crypto.randomUUID(),
      userId,
      shelfEntryId: entryId,
      startedAt: new Date(endedAt.getTime() - 20 * 60_000),
      endedAt,
      focusedSeconds: 1200,
      startPage: 100,
      endPage: options.currentPage ?? 142,
      localDate: endedAt.toISOString().slice(0, 10),
    });
  }
  if (options.consent === false) {
    const current = await (await h.call('/v1/me/preferences', { cookie })).json();
    const saved = await h.call('/v1/me/preferences', {
      method: 'PUT',
      cookie,
      json: { ...(current as object), emailReadingReminders: false },
    });
    expect(saved.status).toBe(200);
  }
  return { email, userId, entryId, cookie };
}

const sentTo = (email: string) => recorder.returns.filter((m) => m.to === email);

describe('reading-return e-mail cron', () => {
  it('e-mails a reader away for ten days once, with real book data and an opt-out link', async () => {
    const away = await reader({ daysSinceReading: 10 });
    const first = await runReadingReturnEmails(h.database.db, TEN_LOCAL, deps());
    expect(first.sent).toBe(1);
    const message = sentTo(away.email)[0];
    expect(message).toMatchObject({
      name: 'Ana Leitora',
      bookTitle: 'Duna',
      currentPage: 142,
      totalPages: 680,
      daysAway: 10,
      bookUrl: `bubo:///livro/${away.entryId}`,
      eventId: `${away.userId}:2026-10-12`,
    });
    expect(message?.unsubscribeUrl).toMatch(
      /^https:\/\/api\.bubo\.example\/v1\/email\/unsubscribe\?token=/,
    );
    const events = await h.database.db.select().from(schema.readerEmailEvents);
    expect(events.filter((event) => event.userId === away.userId)).toHaveLength(1);

    // Same hour again (overlapping cron) and the next day: nothing, the cooldown holds.
    const again = await runReadingReturnEmails(h.database.db, TEN_LOCAL, deps());
    expect(sentTo(away.email)).toHaveLength(1);
    expect(again.sent).toBe(0);
    await runReadingReturnEmails(h.database.db, new Date(TEN_LOCAL.getTime() + DAY), deps());
    expect(sentTo(away.email)).toHaveLength(1);
    // After thirty days it may nudge again, once.
    const later = await runReadingReturnEmails(
      h.database.db,
      new Date(TEN_LOCAL.getTime() + 31 * DAY),
      deps(),
    );
    expect(later.sent).toBe(1);
    expect(sentTo(away.email)).toHaveLength(2);
    expect(sentTo(away.email)[1]?.daysAway).toBe(41);
  });

  it('skips readers who read recently, never read, finished the book, opted out or are at another hour', async () => {
    const recent = await reader({ daysSinceReading: 3 });
    const never = await reader({ daysSinceReading: null });
    const finished = await reader({ daysSinceReading: 12, status: 'finished' });
    const optedOut = await reader({ daysSinceReading: 12, consent: false });
    const eligibleLater = await reader({ daysSinceReading: 12 });
    const elevenLocal = new Date(TEN_LOCAL.getTime() + 60 * 60_000);
    await runReadingReturnEmails(h.database.db, elevenLocal, deps());
    for (const { email } of [recent, never, finished, optedOut, eligibleLater]) {
      expect(sentTo(email)).toHaveLength(0);
    }
    await runReadingReturnEmails(h.database.db, TEN_LOCAL, deps());
    for (const { email } of [recent, never, finished, optedOut]) {
      expect(sentTo(email)).toHaveLength(0);
    }
    expect(sentTo(eligibleLater.email)).toHaveLength(1);
  });

  it('releases the claim when the provider fails so the next hour can retry', async () => {
    const away = await reader({ daysSinceReading: 9, totalPages: null });
    recorder.fail.add('return');
    const failed = await runReadingReturnEmails(h.database.db, TEN_LOCAL, deps());
    expect(failed.sent).toBe(0);
    expect(sentTo(away.email)).toHaveLength(0);
    const events = await h.database.db.select().from(schema.readerEmailEvents);
    expect(events.some((event) => event.userId === away.userId)).toBe(false);
    recorder.fail.delete('return');
    const retried = await runReadingReturnEmails(
      h.database.db,
      new Date(TEN_LOCAL.getTime() + 60 * 60_000 * 24),
      deps(),
    );
    expect(retried.sent).toBe(1);
    expect(sentTo(away.email)[0]?.totalPages).toBe(680);
  });

  it('honours the opt-out link carried by the e-mail', async () => {
    const away = await reader({ daysSinceReading: 15 });
    await runReadingReturnEmails(h.database.db, TEN_LOCAL, deps());
    const link = sentTo(away.email)[0]?.unsubscribeUrl ?? '';
    const url = new URL(link);
    const page = await h.call(`${url.pathname}${url.search}`, { appOrigin: null });
    expect(page.status).toBe(200);
    // Forty days later other readers may be nudged again; this one opted out and never is.
    await runReadingReturnEmails(h.database.db, new Date(TEN_LOCAL.getTime() + 40 * DAY), deps());
    expect(sentTo(away.email)).toHaveLength(1);
  });

  it('runs inside the hourly job next to the review reminders and never sends without a provider', async () => {
    const away = await reader({ daysSinceReading: 20 });
    const result = await runScheduled(h.bindings, {
      now: () => TEN_LOCAL,
      databaseProvider: h.database.provider,
      emailSender: recorder.sender,
      pushFetch: async () => {
        throw new Error('network disabled in tests');
      },
      logger,
    });
    expect(result.emails).toBe(1);
    expect(sentTo(away.email)).toHaveLength(1);

    const silent = await reader({ daysSinceReading: 20 });
    const without = await runScheduled(h.bindings, {
      now: () => TEN_LOCAL,
      databaseProvider: h.database.provider,
      emailSender: { ...recorder.sender, canDeliver: false },
      pushFetch: async () => {
        throw new Error('network disabled in tests');
      },
      logger,
    });
    expect(without.emails).toBe(0);
    expect(sentTo(silent.email)).toHaveLength(0);
  });
});
