import { parseServerEnv } from '@bubo/config';
import { createDatabase, type DatabaseHandle } from '@bubo/database';

import { type Bindings } from './env';
import { createLogger, type Logger } from './lib/logger';
import { type FetchLike } from './services/catalog';
import { createEmailSender, type EmailSender } from './services/email';
import { checkPushReceipts, deliverPush } from './services/push';
import { runReadingReturnEmails } from './services/reading-return-email';
import { runReviewReminders } from './services/reminders';

export type ScheduledDeps = {
  now?: () => Date;
  databaseProvider?: (databaseUrl: string) => DatabaseHandle;
  pushFetch?: FetchLike;
  /** Tests inject a recording sender; the default talks to Resend only when configured. */
  emailSender?: EmailSender;
  logger?: Logger;
};

export type ScheduledResult = { sent: number; reminders: number; emails: number };

/**
 * Cron trigger (hourly, wrangler.toml): daily review reminders at each reader's chosen local
 * hour (ADR-022) and the optional "reading return" e-mail (ADR-038). Never throws: a failed run
 * is logged and the next hour tries again; the two jobs fail independently.
 */
export async function runScheduled(
  env: Bindings,
  deps: ScheduledDeps = {},
): Promise<ScheduledResult> {
  const logger = deps.logger ?? createLogger({ job: 'review-reminders' });
  const config = parseServerEnv({ ...env, MEDIA: undefined });
  if (!config.ok || !config.env.DATABASE_URL) {
    logger.warn('scheduled job skipped: configuration is invalid');
    return { sent: 0, reminders: 0, emails: 0 };
  }
  const handle = (deps.databaseProvider ?? createDatabase)(config.env.DATABASE_URL);
  const result: ScheduledResult = { sent: 0, reminders: 0, emails: 0 };
  try {
    const now = (deps.now ?? (() => new Date()))();
    try {
      const pushDeps = {
        fetch: deps.pushFetch ?? ((input, init) => fetch(input, init)),
        logger,
        now: () => now,
      } satisfies Parameters<typeof deliverPush>[2];
      await checkPushReceipts(handle.db, pushDeps);
      const messages = await runReviewReminders(handle.db, now);
      result.reminders = messages.length;
      result.sent = await deliverPush(handle.db, messages, pushDeps);
      logger.info('review reminders', { reminders: result.reminders, sent: result.sent });
    } catch (error) {
      logger.error('scheduled job failed', {
        job: 'review-reminders',
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
    try {
      const email = deps.emailSender ?? createEmailSender({ config: config.env, logger });
      const baseUrl = config.env.BETTER_AUTH_URL;
      const secret = config.env.BETTER_AUTH_SECRET;
      if (email.canDeliver && baseUrl && secret) {
        const outcome = await runReadingReturnEmails(handle.db, now, {
          email,
          secret,
          baseUrl,
          logger,
        });
        result.emails = outcome.sent;
        logger.info('reading return emails', outcome);
      }
    } catch (error) {
      logger.error('scheduled job failed', {
        job: 'reading-return-emails',
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
    return result;
  } finally {
    await handle.close().catch(() => undefined);
  }
}
