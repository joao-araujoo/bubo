import { type PushTokenRequest } from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import { and, eq, inArray } from 'drizzle-orm';

import { type Logger } from '../lib/logger';
import { type FetchLike } from './catalog';

const { pushTokens, readerPreferences } = schema;

export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100;
const PUSH_TIMEOUT_MS = 2500;

/**
 * One push for one reader. `category` maps to an Android channel and to the reader's switch:
 * reviews (the reminder itself is the opt-in), community and friends. Text carries names and club
 * names only, never content, so a lock screen cannot leak a spoiler or a private reflection.
 */
export type PushMessage = {
  userId: string;
  category: 'reviews' | 'community' | 'friends';
  title: string;
  body: string;
  /** In-app path opened on tap, e.g. `/notificacoes`. */
  url: string;
};

/** Android notification channels (created by the app with the same ids). */
export const PUSH_CHANNEL: Record<PushMessage['category'], string> = {
  reviews: 'lembretes',
  community: 'comunidade',
  friends: 'comunidade',
};

export async function registerPushToken(db: Executor, userId: string, input: PushTokenRequest) {
  // A device that signs in with another account moves its token to that account.
  await db
    .insert(pushTokens)
    .values({ token: input.token, userId, platform: input.platform })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { userId, platform: input.platform, updatedAt: new Date() },
    });
}

export async function removePushToken(db: Executor, userId: string, token: string) {
  await db
    .delete(pushTokens)
    .where(and(eq(pushTokens.token, token), eq(pushTokens.userId, userId)));
}

type ExpoTicket = { status: 'ok' | 'error'; details?: { error?: string } };

/**
 * Delivers pushes through the Expo push service. Readers who turned a category off, or have no
 * device, are skipped. Tokens Expo reports as unregistered are deleted. Never throws: a failed
 * push must not fail the action that caused it.
 */
export async function deliverPush(
  db: Executor,
  messages: readonly PushMessage[],
  deps: { fetch: FetchLike; logger: Logger },
): Promise<number> {
  if (messages.length === 0) return 0;
  try {
    const userIds = [...new Set(messages.map((message) => message.userId))];
    const [tokens, prefs] = await Promise.all([
      db.select().from(pushTokens).where(inArray(pushTokens.userId, userIds)),
      db.select().from(readerPreferences).where(inArray(readerPreferences.userId, userIds)),
    ]);
    const prefsOf = new Map(prefs.map((row) => [row.userId, row]));
    const allowed = (message: PushMessage) => {
      const pref = prefsOf.get(message.userId);
      if (message.category === 'community') return pref?.notifyCommunity ?? true;
      if (message.category === 'friends') return pref?.notifyFriends ?? true;
      return true;
    };
    const outgoing = messages.filter(allowed).flatMap((message) =>
      tokens
        .filter((token) => token.userId === message.userId)
        .map((token) => ({
          to: token.token,
          title: message.title,
          body: message.body,
          sound: 'default',
          priority: 'high',
          channelId: PUSH_CHANNEL[message.category],
          data: { url: message.url },
        })),
    );
    let sent = 0;
    const stale: string[] = [];
    for (let start = 0; start < outgoing.length; start += EXPO_BATCH) {
      const batch = outgoing.slice(start, start + EXPO_BATCH);
      const response = await deps.fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
      });
      if (!response.ok) {
        deps.logger.warn('push batch refused', { status: response.status, size: batch.length });
        continue;
      }
      const body = (await response.json()) as { data?: ExpoTicket[] };
      (body.data ?? []).forEach((ticket, index) => {
        if (ticket.status === 'ok') sent += 1;
        else if (ticket.details?.error === 'DeviceNotRegistered') {
          const to = batch[index]?.to;
          if (to) stale.push(to);
        }
      });
    }
    if (stale.length) await db.delete(pushTokens).where(inArray(pushTokens.token, stale));
    return sent;
  } catch (error) {
    deps.logger.warn('push delivery failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return 0;
  }
}
