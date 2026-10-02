import { parseServerEnv } from '@bubo/config';
import { createDatabase, type DatabaseHandle } from '@bubo/database';

import { type Bindings } from './env';
import { createLogger, type Logger } from './lib/logger';
import { type FetchLike } from './services/catalog';
import { deliverPush } from './services/push';
import { runReviewReminders } from './services/reminders';

export type ScheduledDeps = {
  now?: () => Date;
  databaseProvider?: (databaseUrl: string) => DatabaseHandle;
  pushFetch?: FetchLike;
  logger?: Logger;
};

/**
 * Cron trigger (hourly, wrangler.toml): daily review reminders at each reader's chosen local
 * hour (ADR-022). Never throws: a failed run is logged and the next hour tries again.
 */
export async function runScheduled(env: Bindings, deps: ScheduledDeps = {}) {
  const logger = deps.logger ?? createLogger({ job: 'review-reminders' });
  const config = parseServerEnv({ ...env, MEDIA: undefined });
  if (!config.ok || !config.env.DATABASE_URL) {
    logger.warn('scheduled job skipped: configuration is invalid');
    return { sent: 0, reminders: 0 };
  }
  const handle = (deps.databaseProvider ?? createDatabase)(config.env.DATABASE_URL);
  try {
    const messages = await runReviewReminders(handle.db, (deps.now ?? (() => new Date()))());
    const sent = await deliverPush(handle.db, messages, {
      fetch: deps.pushFetch ?? ((input, init) => fetch(input, init)),
      logger,
    });
    logger.info('review reminders', { reminders: messages.length, sent });
    return { sent, reminders: messages.length };
  } catch (error) {
    logger.error('scheduled job failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return { sent: 0, reminders: 0 };
  } finally {
    await handle.close().catch(() => undefined);
  }
}
