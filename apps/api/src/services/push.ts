import { type PushTokenRequest } from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import { and, eq, gt, inArray, lte } from 'drizzle-orm';
import { z } from 'zod';

import { type Logger } from '../lib/logger';
import { type FetchLike } from './catalog';

const { pushTokens, pushReceipts, readerPreferences, sessions } = schema;
export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_BATCH = 100;
const RECEIPT_BATCH = 1000;
const PUSH_TIMEOUT_MS = 5000;
const RECEIPT_WAIT_MS = 15 * 60_000;
const RECEIPT_EXPIRY_MS = 23 * 60 * 60_000;

/** Private content never enters a push. Category switches are checked again at delivery. */
export type PushMessage = {
  userId: string;
  category: 'reviews' | 'community' | 'friends';
  title: string;
  body: string;
  url: string;
};

/** Android channel ids are also used by the mobile client. */
export const PUSH_CHANNEL: Record<PushMessage['category'], string> = {
  reviews: 'lembretes',
  community: 'comunidade',
  friends: 'comunidade',
};

export async function registerPushToken(
  db: Executor,
  userId: string,
  sessionId: string,
  input: PushTokenRequest,
) {
  const registrationId = crypto.randomUUID();
  const updatedAt = new Date();
  await db
    .insert(pushTokens)
    .values({
      token: input.token,
      userId,
      sessionId,
      platform: input.platform,
      registrationId,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { userId, sessionId, platform: input.platform, registrationId, updatedAt },
    });
}

export async function removePushToken(db: Executor, userId: string, token: string) {
  await db
    .delete(pushTokens)
    .where(and(eq(pushTokens.token, token), eq(pushTokens.userId, userId)));
}

const receiptSchema = z.object({
  status: z.enum(['ok', 'error']),
  id: z.string().min(1).optional(),
  details: z.object({ error: z.string().optional() }).optional(),
});
const ticketsSchema = z.object({ data: z.array(receiptSchema) });
const receiptsSchema = z.object({ data: z.record(z.string(), receiptSchema) });
type PushDeps = { fetch: FetchLike; logger: Logger; now?: () => Date };

/** A stale response must never delete a device re-registered since the message was sent. */
async function removeStaleToken(db: Executor, token: string, registrationId: string) {
  await db
    .delete(pushTokens)
    .where(and(eq(pushTokens.token, token), eq(pushTokens.registrationId, registrationId)));
}

/**
 * Counts accepted Expo tickets, not provider success or device display. Delivery failures cannot
 * fail the reader's action. Ambiguous network failures are not resent: Expo may have accepted
 * them already, and resending could show the same notification twice.
 */
export async function deliverPush(
  db: Executor,
  messages: readonly PushMessage[],
  deps: PushDeps,
): Promise<number> {
  if (messages.length === 0) return 0;
  let accepted = 0;
  try {
    const now = (deps.now ?? (() => new Date()))();
    const userIds = [...new Set(messages.map((message) => message.userId))];
    const [tokens, prefs] = await Promise.all([
      db
        .select({
          token: pushTokens.token,
          userId: pushTokens.userId,
          registrationId: pushTokens.registrationId,
        })
        .from(pushTokens)
        .innerJoin(sessions, eq(pushTokens.sessionId, sessions.id))
        .where(and(inArray(pushTokens.userId, userIds), gt(sessions.expiresAt, now))),
      db.select().from(readerPreferences).where(inArray(readerPreferences.userId, userIds)),
    ]);
    const prefsOf = new Map(prefs.map((row) => [row.userId, row]));
    const allowed = (message: PushMessage) => {
      const pref = prefsOf.get(message.userId);
      if (message.category === 'community') return pref?.notifyCommunity ?? true;
      if (message.category === 'friends') return pref?.notifyFriends ?? true;
      return pref?.reviewReminder ?? false;
    };
    const outgoing = messages.filter(allowed).flatMap((message) =>
      tokens
        .filter((token) => token.userId === message.userId)
        .map((token) => ({
          registrationId: token.registrationId,
          payload: {
            to: token.token,
            title: message.title,
            body: message.body,
            sound: 'default',
            priority: 'normal',
            ttl: message.category === 'reviews' ? 3600 : 14_400,
            channelId: PUSH_CHANNEL[message.category],
            data: { url: message.url, userId: message.userId },
          },
        })),
    );
    for (let start = 0; start < outgoing.length; start += EXPO_BATCH) {
      // Stay under Expo's 600 notifications/second/project for this batch stream.
      if (start > 0) await new Promise<void>((resolve) => setTimeout(resolve, 200));
      const batch = outgoing.slice(start, start + EXPO_BATCH);
      try {
        const init: RequestInit = {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify(batch.map((item) => item.payload)),
          signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
        };
        let response = await deps.fetch(EXPO_PUSH_URL, init);
        // A 429 explicitly refuses the batch. Retry once; timeouts are ambiguous and not resent.
        if (response.status === 429) {
          await new Promise<void>((resolve) => setTimeout(resolve, 400));
          response = await deps.fetch(EXPO_PUSH_URL, {
            ...init,
            signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
          });
        }
        if (!response.ok) {
          deps.logger.warn('push batch refused', { status: response.status, size: batch.length });
          continue;
        }
        const parsed = ticketsSchema.safeParse(await response.json());
        if (!parsed.success || parsed.data.data.length !== batch.length) {
          deps.logger.warn('push tickets invalid', { size: batch.length });
          continue;
        }
        for (const [index, ticket] of parsed.data.data.entries()) {
          const item = batch[index];
          if (!item) continue;
          if (ticket.status === 'ok' && ticket.id) {
            accepted += 1;
            try {
              await db
                .insert(pushReceipts)
                .values({
                  id: ticket.id,
                  token: item.payload.to,
                  registrationId: item.registrationId,
                  createdAt: now,
                  checkAfter: new Date(now.getTime() + RECEIPT_WAIT_MS),
                })
                .onConflictDoNothing();
            } catch {
              // Logout can delete one token during the request. Keep monitoring the others.
              deps.logger.warn('push receipt persistence failed', { count: 1 });
            }
          } else if (ticket.details?.error === 'DeviceNotRegistered') {
            await removeStaleToken(db, item.payload.to, item.registrationId);
          } else {
            // Free-form provider messages can contain tokens: never log their text.
            deps.logger.warn('push ticket rejected', { count: 1 });
          }
        }
      } catch (error) {
        deps.logger.warn('push batch failed', {
          error: error instanceof Error ? error.name : 'unknown',
          size: batch.length,
        });
      }
    }
  } catch (error) {
    deps.logger.warn('push delivery failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
  }
  return accepted;
}

/** Hourly durable receipt drain. Pending/failed queries retry without sending another push. */
export async function checkPushReceipts(db: Executor, deps: PushDeps): Promise<number> {
  const now = (deps.now ?? (() => new Date()))();
  try {
    const pending = await db
      .select()
      .from(pushReceipts)
      .where(lte(pushReceipts.checkAfter, now))
      .orderBy(pushReceipts.checkAfter)
      .limit(RECEIPT_BATCH);
    if (pending.length === 0) return 0;
    const expired = pending.filter(
      (row) => now.getTime() - row.createdAt.getTime() >= RECEIPT_EXPIRY_MS,
    );
    if (expired.length) {
      await db.delete(pushReceipts).where(
        inArray(
          pushReceipts.id,
          expired.map((row) => row.id),
        ),
      );
      deps.logger.warn('push receipts expired', { count: expired.length });
    }
    const waiting = pending.filter((row) => !expired.includes(row));
    if (waiting.length === 0) return 0;
    const response = await deps.fetch(EXPO_RECEIPTS_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ ids: waiting.map((row) => row.id) }),
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
    if (!response.ok) {
      deps.logger.warn('push receipts refused', { status: response.status, count: waiting.length });
      return 0;
    }
    const parsed = receiptsSchema.safeParse(await response.json());
    if (!parsed.success) {
      deps.logger.warn('push receipts invalid', { count: waiting.length });
      return 0;
    }
    const resolved: string[] = [];
    for (const row of waiting) {
      const receipt = parsed.data.data[row.id];
      if (!receipt) continue;
      if (receipt.status === 'error') {
        if (receipt.details?.error === 'DeviceNotRegistered') {
          await removeStaleToken(db, row.token, row.registrationId);
        }
        deps.logger.warn('push provider rejected', { count: 1 });
      }
      resolved.push(row.id);
    }
    if (resolved.length) await db.delete(pushReceipts).where(inArray(pushReceipts.id, resolved));
    return resolved.length;
  } catch (error) {
    deps.logger.warn('push receipts failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return 0;
  }
}
