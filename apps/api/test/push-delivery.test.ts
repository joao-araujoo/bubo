import { meResponseSchema } from '@bubo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  checkPushReceipts,
  deliverPush,
  EXPO_PUSH_URL,
  EXPO_RECEIPTS_URL,
  type PushMessage,
} from '../src/services/push';
import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
beforeAll(async () => {
  h = await createHarness();
}, 60_000);
afterAll(async () => {
  await h.close();
});

const logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  },
};
const now = new Date();
async function device() {
  const { cookie } = await h.signUp();
  const me = meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
  const token = `ExponentPushToken[${crypto.randomUUID()}]`;
  await h.call('/v1/me/push-token', { method: 'POST', cookie, json: { token, platform: 'ios' } });
  const message: PushMessage = {
    userId: me.user.id,
    category: 'community',
    title: 'Clube',
    body: 'Uma resposta chegou.',
    url: '/notificacoes',
  };
  return { cookie, token, id: me.user.id, message };
}

describe('push delivery receipts', () => {
  it('checks provider receipts after 15 minutes and removes unregistered devices', async () => {
    const a = await device();
    const ticketId = crypto.randomUUID();
    const fetch = async (input: string, init?: RequestInit) => {
      if (input === EXPO_PUSH_URL) {
        const body = JSON.parse(String(init?.body)) as { data: { userId: string }; ttl: number }[];
        expect(body[0]?.data.userId).toBe(a.id);
        expect(body[0]?.ttl).toBe(14_400);
        return Response.json({ data: [{ status: 'ok', id: ticketId }] });
      }
      expect(input).toBe(EXPO_RECEIPTS_URL);
      expect(JSON.parse(String(init?.body))).toEqual({ ids: [ticketId] });
      return Response.json({
        data: { [ticketId]: { status: 'error', details: { error: 'DeviceNotRegistered' } } },
      });
    };
    expect(await deliverPush(h.database.db, [a.message], { fetch, logger, now: () => now })).toBe(
      1,
    );
    expect(
      await checkPushReceipts(h.database.db, {
        fetch,
        logger,
        now: () => new Date(now.getTime() + 14 * 60_000),
      }),
    ).toBe(0);
    expect(
      await checkPushReceipts(h.database.db, {
        fetch,
        logger,
        now: () => new Date(now.getTime() + 15 * 60_000),
      }),
    ).toBe(1);
    expect(
      (await h.database.pg.query('SELECT 1 FROM reader_push_tokens WHERE token = $1', [a.token]))
        .rows,
    ).toEqual([]);
  });

  it('a delayed stale receipt cannot remove a device transferred to another login', async () => {
    const a = await device();
    const ticketId = crypto.randomUUID();
    await deliverPush(h.database.db, [a.message], {
      fetch: async () => Response.json({ data: [{ status: 'ok', id: ticketId }] }),
      logger,
      now: () => now,
    });
    const before = await h.database.pg.query<{ updated_at: string }>(
      'SELECT updated_at FROM reader_push_tokens WHERE token = $1',
      [a.token],
    );
    await h.call('/v1/me/push-token', {
      method: 'POST',
      cookie: a.cookie,
      json: { token: a.token, platform: 'ios' },
    });
    // Same timestamp still means a different immutable registration generation.
    await h.database.pg.query('UPDATE reader_push_tokens SET updated_at = $1 WHERE token = $2', [
      before.rows[0]?.updated_at,
      a.token,
    ]);
    expect(
      await checkPushReceipts(h.database.db, {
        fetch: async () =>
          Response.json({
            data: { [ticketId]: { status: 'error', details: { error: 'DeviceNotRegistered' } } },
          }),
        logger,
        now: () => new Date(now.getTime() + 16 * 60_000),
      }),
    ).toBe(1);
    expect(
      (await h.database.pg.query('SELECT 1 FROM reader_push_tokens WHERE token = $1', [a.token]))
        .rows,
    ).toHaveLength(1);
  });

  it('retries missing or failed receipts without resending and eventually expires them', async () => {
    const a = await device();
    const ticketId = crypto.randomUUID();
    await deliverPush(h.database.db, [a.message], {
      fetch: async () => Response.json({ data: [{ status: 'ok', id: ticketId }] }),
      logger,
      now: () => now,
    });
    const later = () => new Date(now.getTime() + 16 * 60_000);
    const fetch = async (input: string) => {
      expect(input).toBe(EXPO_RECEIPTS_URL);
      return Response.json({ data: {} });
    };
    expect(await checkPushReceipts(h.database.db, { fetch, logger, now: later })).toBe(0);
    expect(
      (await h.database.pg.query('SELECT 1 FROM reader_push_receipts WHERE id = $1', [ticketId]))
        .rows,
    ).toHaveLength(1);
    await checkPushReceipts(h.database.db, {
      fetch: async () => {
        throw new Error('offline');
      },
      logger,
      now: later,
    });
    expect(
      (await h.database.pg.query('SELECT 1 FROM reader_push_receipts WHERE id = $1', [ticketId]))
        .rows,
    ).toHaveLength(1);
    await checkPushReceipts(h.database.db, {
      fetch,
      logger,
      now: () => new Date(now.getTime() + 23 * 60 * 60_000),
    });
    expect(
      (await h.database.pg.query('SELECT 1 FROM reader_push_receipts WHERE id = $1', [ticketId]))
        .rows,
    ).toEqual([]);
  });

  it('rechecks opt-in and excludes revoked or expired login tokens', async () => {
    const a = await device();
    const fetch = async () => {
      throw new Error('must not send');
    };
    expect(
      await deliverPush(h.database.db, [{ ...a.message, category: 'reviews' }], {
        fetch,
        logger,
        now: () => now,
      }),
    ).toBe(0);
    await h.call('/v1/auth/sign-out', { method: 'POST', cookie: a.cookie, json: {} });
    expect(
      (await h.database.pg.query('SELECT 1 FROM reader_push_tokens WHERE token = $1', [a.token]))
        .rows,
    ).toEqual([]);
    expect(await deliverPush(h.database.db, [a.message], { fetch, logger, now: () => now })).toBe(
      0,
    );
    const b = await device();
    await h.database.pg.query('UPDATE sessions SET expires_at = $1 WHERE user_id = $2', [
      new Date(now.getTime() - 1000),
      b.id,
    ]);
    expect(await deliverPush(h.database.db, [b.message], { fetch, logger, now: () => now })).toBe(
      0,
    );
  });

  it('rejects registration when its initiating account differs from the session', async () => {
    const a = await device();
    const response = await h.call('/v1/me/push-token', {
      method: 'POST',
      cookie: a.cookie,
      json: { token: a.token, platform: 'ios', expectedUserId: 'another-reader' },
    });
    expect(response.status).toBe(409);
  });

  it('retries a refused rate-limited batch once', async () => {
    const a = await device();
    let calls = 0;
    const accepted = await deliverPush(h.database.db, [a.message], {
      fetch: async () => {
        calls += 1;
        return calls === 1
          ? new Response(null, { status: 429 })
          : Response.json({ data: [{ status: 'ok', id: crypto.randomUUID() }] });
      },
      logger,
      now: () => now,
    });
    expect(accepted).toBe(1);
    expect(calls).toBe(2);
  });

  it('persists other tickets when one token is revoked during batch acceptance', async () => {
    const a = await device();
    const b = await device();
    const firstTicket = crypto.randomUUID();
    const secondTicket = crypto.randomUUID();
    const accepted = await deliverPush(h.database.db, [a.message, b.message], {
      fetch: async () => {
        await h.database.pg.query('DELETE FROM reader_push_tokens WHERE token = $1', [a.token]);
        return Response.json({
          data: [
            { status: 'ok', id: firstTicket },
            { status: 'ok', id: secondTicket },
          ],
        });
      },
      logger,
      now: () => now,
    });
    expect(accepted).toBe(2);
    expect(
      (
        await h.database.pg.query('SELECT 1 FROM reader_push_receipts WHERE id = $1', [
          secondTicket,
        ])
      ).rows,
    ).toHaveLength(1);
    await h.database.pg.query('DELETE FROM reader_push_receipts WHERE id = $1', [secondTicket]);
  });
});
