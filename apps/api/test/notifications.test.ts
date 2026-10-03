import {
  clubDetailSchema,
  dueCardsResponseSchema,
  meResponseSchema,
  notificationsResponseSchema,
  readerPreferencesSchema,
  shelfEntrySchema,
  statsResponseSchema,
} from '@bubo/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PGLITE_DATABASE_URL } from '../dev/pglite';
import { runScheduled } from '../src/scheduled';
import { EXPO_PUSH_URL, EXPO_RECEIPTS_URL } from '../src/services/push';
import { createHarness } from './harness';
import { VALID_SESSION_RECALL } from './session-fixtures';

type Sent = { to: string; title: string; body: string; channelId: string; data: { url: string } };

let now = new Date('2026-09-30T12:00:00Z');
let sent: Sent[] = [];
/** Tokens the fake Expo endpoint reports as uninstalled. */
const unregistered = new Set<string>();

const pushFetch = async (input: string, init?: RequestInit) => {
  if (input === EXPO_RECEIPTS_URL) return Response.json({ data: {} });
  expect(input).toBe(EXPO_PUSH_URL);
  const batch = JSON.parse(String(init?.body)) as Sent[];
  sent.push(...batch);
  return Response.json({
    data: batch.map((message) =>
      unregistered.has(message.to)
        ? { status: 'error', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok', id: crypto.randomUUID() },
    ),
  });
};

let h: Awaited<ReturnType<typeof createHarness>>;
beforeAll(async () => {
  h = await createHarness({ now: () => now, pushFetch });
}, 60000);
afterAll(async () => {
  await h.close();
});
beforeEach(() => {
  sent = [];
});

let tokenCounter = 0;
async function reader() {
  const { cookie } = await h.signUp();
  const me = meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
  tokenCounter += 1;
  const token = `ExponentPushToken[device-token-${String(tokenCounter).padStart(4, '0')}]`;
  return { cookie, id: me.user.id, token };
}
const registerDevice = (who: { cookie: string; token: string }) =>
  h.call('/v1/me/push-token', {
    method: 'POST',
    cookie: who.cookie,
    json: { token: who.token, platform: 'android' },
  });
const inbox = async (who: { cookie: string }) =>
  notificationsResponseSchema.parse(
    await (await h.call('/v1/notifications', { cookie: who.cookie })).json(),
  );
const preferences = async (who: { cookie: string }) =>
  readerPreferencesSchema.parse(
    await (await h.call('/v1/me/preferences', { cookie: who.cookie })).json(),
  );
const savePreferences = (who: { cookie: string }, patch: Record<string, unknown>) =>
  preferences(who).then((current) =>
    h.call('/v1/me/preferences', {
      method: 'PUT',
      cookie: who.cookie,
      json: { ...current, ...patch },
    }),
  );

/** A club on a catalog book, owned by `owner`, joined by `member`. */
async function clubWith(owner: { cookie: string; id: string }, member: { cookie: string }) {
  const key = crypto.randomUUID();
  await h.database.pg.query(
    `INSERT INTO books (id, title, total_pages, catalog_key) VALUES ($1, 'Livro do clube', 300, $2)`,
    [`book-${key}`, `ol:${key}`],
  );
  await h.database.pg.query(
    `INSERT INTO shelf_entries (id, user_id, book_id) VALUES ($1, $2, $3)`,
    [`entry-${key}`, owner.id, `book-${key}`],
  );
  const club = clubDetailSchema.parse(
    await (
      await h.call('/v1/clubs', {
        method: 'POST',
        cookie: owner.cookie,
        json: { name: 'Clube dos avisos', icon: 'mind', shelfEntryId: `entry-${key}` },
      })
    ).json(),
  );
  await h.call(`/v1/clubs/${club.id}/membership`, {
    method: 'PUT',
    cookie: member.cookie,
    json: { acceptGuidelines: true },
  });
  return club;
}

describe('preferences', () => {
  it('starts from honest defaults, validates and persists every field', async () => {
    const a = await reader();
    expect((await h.call('/v1/me/preferences')).status).toBe(401);
    expect(await preferences(a)).toEqual({
      reviewIntensity: 'balanced',
      dailyReviewLimit: 20,
      dailyFocusMinutes: 20,
      annualBookGoal: null,
      reviewReminder: false,
      reminderHour: 19,
      timeZone: 'America/Sao_Paulo',
      notifyCommunity: true,
      notifyFriends: true,
    });
    for (const bad of [
      { timeZone: 'Mars/Olympus' },
      { dailyReviewLimit: 4 },
      { dailyFocusMinutes: 25 },
      { reminderHour: 24 },
      { annualBookGoal: 0 },
      { reviewIntensity: 'extreme' },
    ]) {
      expect((await savePreferences(a, bad)).status).toBe(422);
    }
    const saved = await savePreferences(a, {
      reviewIntensity: 'gentle',
      dailyReviewLimit: 5,
      dailyFocusMinutes: 30,
      annualBookGoal: 12,
      reviewReminder: true,
      reminderHour: 8,
      timeZone: 'Europe/Lisbon',
    });
    expect(saved.status).toBe(200);
    expect(await preferences(a)).toMatchObject({
      reviewIntensity: 'gentle',
      dailyReviewLimit: 5,
      dailyFocusMinutes: 30,
      annualBookGoal: 12,
      reviewReminder: true,
      reminderHour: 8,
      timeZone: 'Europe/Lisbon',
    });
  });
});

describe('push tokens', () => {
  it('accepts only Expo tokens, moves a device between accounts and forgets on sign-out', async () => {
    const a = await reader();
    const b = await reader();
    expect(
      (
        await h.call('/v1/me/push-token', {
          method: 'POST',
          cookie: a.cookie,
          json: { token: 'not-a-token', platform: 'android' },
        })
      ).status,
    ).toBe(422);
    expect((await registerDevice(a)).status).toBe(200);
    // Same phone, other account: the token follows the account now signed in.
    expect((await registerDevice({ ...b, token: a.token })).status).toBe(200);
    const { rows } = await h.database.pg.query<{ user_id: string }>(
      'SELECT user_id FROM reader_push_tokens WHERE token = $1',
      [a.token],
    );
    expect(rows).toEqual([{ user_id: b.id }]);
    // Removing someone else's token does nothing.
    await h.call(`/v1/me/push-token/${encodeURIComponent(a.token)}`, {
      method: 'DELETE',
      cookie: a.cookie,
    });
    expect(
      (await h.database.pg.query('SELECT 1 FROM reader_push_tokens WHERE token = $1', [a.token]))
        .rows,
    ).toHaveLength(1);
    const removed = await h.call(`/v1/me/push-token/${encodeURIComponent(a.token)}`, {
      method: 'DELETE',
      cookie: b.cookie,
    });
    expect(await removed.json()).toEqual({ registered: false });
    expect(
      (await h.database.pg.query('SELECT 1 FROM reader_push_tokens WHERE token = $1', [a.token]))
        .rows,
    ).toHaveLength(0);
  });
});

describe('notification inbox', () => {
  it('groups replies, pushes without content, respects switches, blocks and read state', async () => {
    const author = await reader();
    const replier = await reader();
    await registerDevice(author);
    const club = await clubWith(author, replier);
    const topic = await (
      await h.call(`/v1/clubs/${club.id}/posts`, {
        method: 'POST',
        cookie: author.cookie,
        json: {
          id: crypto.randomUUID(),
          title: 'O que o final quer dizer?',
          body: 'Minha leitura.',
          spoilerPage: 0,
        },
      })
    ).json();
    const reply = (who: { cookie: string }, body: string) =>
      h.call(`/v1/clubs/${club.id}/posts/${topic.id}/replies`, {
        method: 'POST',
        cookie: who.cookie,
        json: { id: crypto.randomUUID(), body, spoilerPage: 0 },
      });
    expect((await reply(replier, 'TEXTO_DA_RESPOSTA_SECRETA')).status).toBe(201);
    expect((await reply(replier, 'Outra resposta')).status).toBe(201);
    // Answering yourself never notifies.
    expect((await reply(author, 'Obrigado')).status).toBe(201);

    const box = await inbox(author);
    expect(box.unreadCount).toBe(1);
    expect(box.items[0]).toMatchObject({
      kind: 'topic_reply',
      read: false,
      count: 2,
      actor: { id: replier.id },
      club: { id: club.id, name: 'Clube dos avisos' },
      post: { id: topic.id, title: 'O que o final quer dizer?', isReview: false },
    });
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({
      to: author.token,
      title: 'Clube dos avisos',
      channelId: 'comunidade',
      data: { url: `/debates/${club.id}/${topic.id}` },
    });
    expect(JSON.stringify(sent)).not.toContain('TEXTO_DA_RESPOSTA_SECRETA');
    expect(JSON.stringify(box)).not.toContain('TEXTO_DA_RESPOSTA_SECRETA');
    expect((await inbox(replier)).items).toEqual([]);

    // Community pushes off: the inbox still records, nothing is pushed.
    await savePreferences(author, { notifyCommunity: false });
    sent = [];
    await reply(replier, 'Terceira resposta');
    expect(sent).toEqual([]);
    expect((await inbox(author)).items[0]?.count).toBe(3);

    // Read one, then a new reply opens a fresh group.
    const marked = notificationsResponseSchema.parse(
      await (
        await h.call('/v1/notifications/read', {
          method: 'POST',
          cookie: author.cookie,
          json: { ids: [box.items[0]?.id] },
        })
      ).json(),
    );
    expect(marked.unreadCount).toBe(0);
    now = new Date(now.getTime() + 60_000);
    await reply(replier, 'Quarta resposta');
    const after = await inbox(author);
    expect(after.unreadCount).toBe(1);
    expect(after.items.map((item) => item.count)).toEqual([1, 3]);
    expect(
      (
        await h.call('/v1/notifications/read', {
          method: 'POST',
          cookie: author.cookie,
          json: { ids: [] },
        })
      ).status,
    ).toBe(422);
    await h.call('/v1/notifications/read', {
      method: 'POST',
      cookie: author.cookie,
      json: { all: true },
    });
    expect((await inbox(author)).unreadCount).toBe(0);

    // Blocking hides everything that reader caused.
    await h.call('/v1/blocks', {
      method: 'POST',
      cookie: author.cookie,
      json: { userId: replier.id },
    });
    expect((await inbox(author)).items).toEqual([]);
    expect((await h.call('/v1/notifications')).status).toBe(401);
  });

  it('notifies friend requests and acceptances once, and cycles to members only', async () => {
    const owner = await reader();
    const member = await reader();
    await registerDevice(member);
    await registerDevice(owner);
    const club = await clubWith(owner, member);

    const friend = (from: { cookie: string }, to: { id: string }, action: string) =>
      h.call(`/v1/community/friends/${to.id}`, {
        method: 'PUT',
        cookie: from.cookie,
        json: { action },
      });
    expect((await friend(owner, member, 'request')).status).toBe(200);
    await friend(owner, member, 'request');
    const request = await inbox(member);
    expect(request.items).toHaveLength(1);
    expect(request.items[0]).toMatchObject({ kind: 'friend_request', actor: { id: owner.id } });
    expect(sent.filter((message) => message.to === member.token)).toHaveLength(1);
    expect(sent[0]?.channelId).toBe('comunidade');

    expect((await friend(member, owner, 'accept')).status).toBe(200);
    await friend(member, owner, 'accept');
    // The answered request leaves the member's inbox; the owner learns it was accepted.
    expect((await inbox(member)).items).toEqual([]);
    const accepted = await inbox(owner);
    expect(accepted.items.map((item) => item.kind)).toEqual(['friend_accepted']);
    expect(sent.filter((message) => message.to === owner.token)).toHaveLength(1);

    sent = [];
    unregistered.add(member.token);
    const cycleId = crypto.randomUUID();
    const start = () =>
      h.call(`/v1/clubs/${club.id}/cycles`, {
        method: 'POST',
        cookie: owner.cookie,
        json: { id: cycleId, goalPages: 40, durationDays: 14 },
      });
    expect((await start()).status).toBe(200);
    expect((await start()).status).toBe(200);
    const cycle = (await inbox(member)).items.find((item) => item.kind === 'cycle_started');
    expect(cycle).toMatchObject({ count: 40, club: { id: club.id } });
    expect((await inbox(owner)).items.some((item) => item.kind === 'cycle_started')).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.data.url).toBe(`/ciclos/${club.id}`);
    // Expo said the app was uninstalled: the token is gone.
    expect(
      (
        await h.database.pg.query('SELECT 1 FROM reader_push_tokens WHERE token = $1', [
          member.token,
        ])
      ).rows,
    ).toHaveLength(0);

    // Leaving the club hides its notifications.
    await h.call(`/v1/clubs/${club.id}/membership`, { method: 'DELETE', cookie: member.cookie });
    expect((await inbox(member)).items.some((item) => item.club?.id === club.id)).toBe(false);
  });
});

describe('review preferences', () => {
  it('applies the daily limit and the interval rigor, and reports focus minutes today', async () => {
    now = new Date('2026-09-30T12:00:00Z');
    const a = await reader();
    const entry = shelfEntrySchema.parse(
      await (
        await h.call('/v1/shelf', {
          method: 'POST',
          cookie: a.cookie,
          json: { title: 'O Estrangeiro', totalPages: 128 },
        })
      ).json(),
    );
    for (let index = 0; index < 7; index += 1) {
      await h.call('/v1/recall/cards', {
        method: 'POST',
        cookie: a.cookie,
        json: { shelfEntryId: entry.id, prompt: `Pergunta ${index}?`, localDate: '2026-09-30' },
      });
    }
    await h.database.pg.query(
      `UPDATE recall_cards SET due_date = '2026-09-30', repetitions = 1, interval_days = 1 WHERE user_id = $1`,
      [a.id],
    );
    await savePreferences(a, { dailyReviewLimit: 5, reviewIntensity: 'gentle' });
    const due = async () =>
      dueCardsResponseSchema.parse(
        await (await h.call('/v1/recall/due?today=2026-09-30', { cookie: a.cookie })).json(),
      );
    const before = await due();
    expect(before).toMatchObject({ dueCount: 7, dailyLimit: 5, reviewedToday: 0 });
    expect(before.cards).toHaveLength(5);
    const first = before.cards[0];
    const graded = await h.call(`/v1/recall/cards/${first?.id}/review`, {
      method: 'POST',
      cookie: a.cookie,
      json: { id: crypto.randomUUID(), grade: 4, localDate: '2026-09-30' },
    });
    // SM-2 gives 6 days on the second success; "Suave" spaces it to 8.
    expect((await graded.json()).card).toMatchObject({ intervalDays: 8, dueDate: '2026-10-08' });
    const after = await due();
    expect(after).toMatchObject({ dueCount: 6, reviewedToday: 1 });
    expect(after.cards).toHaveLength(4);

    await h.call('/v1/sessions', {
      method: 'POST',
      cookie: a.cookie,
      json: {
        id: crypto.randomUUID(),
        shelfEntryId: entry.id,
        startedAt: '2026-09-30T10:00:00Z',
        endedAt: '2026-09-30T10:30:00Z',
        focusedSeconds: 25 * 60,
        endPage: 20,
        reflection: null,
        recall: VALID_SESSION_RECALL,
        localDate: '2026-09-30',
      },
    });
    const stats = statsResponseSchema.parse(
      await (await h.call('/v1/me/stats?today=2026-09-30', { cookie: a.cookie })).json(),
    );
    expect(stats.focusedMinutesToday).toBe(25);
  });
});

describe('review reminder cron', () => {
  it('reminds once per local day at the chosen hour, only with due cards', async () => {
    const a = await reader();
    const quiet = await reader();
    await registerDevice(a);
    await registerDevice(quiet);
    for (const who of [a, quiet]) {
      await savePreferences(who, {
        reviewReminder: true,
        reminderHour: 9,
        timeZone: 'America/Sao_Paulo',
      });
    }
    const entry = shelfEntrySchema.parse(
      await (
        await h.call('/v1/shelf', {
          method: 'POST',
          cookie: a.cookie,
          json: { title: 'Duna', totalPages: 600 },
        })
      ).json(),
    );
    now = new Date('2026-10-01T11:00:00Z');
    await h.call('/v1/recall/cards', {
      method: 'POST',
      cookie: a.cookie,
      json: { shelfEntryId: entry.id, prompt: 'O que é a especiaria?', localDate: '2026-10-01' },
    });
    await h.database.pg.query(
      `UPDATE recall_cards SET due_date = '2026-10-01' WHERE user_id = $1`,
      [a.id],
    );
    const env = { DATABASE_URL: PGLITE_DATABASE_URL, BETTER_AUTH_SECRET: 'x'.repeat(40) };
    const run = (at: string) =>
      runScheduled(env as never, {
        now: () => new Date(at),
        databaseProvider: h.database.provider,
        pushFetch,
        logger: {
          debug() {},
          info() {},
          warn() {},
          error() {},
          child() {
            return this;
          },
        },
      });
    // 08:00 in São Paulo: not yet.
    expect(await run('2026-10-01T11:00:00Z')).toEqual({ sent: 0, reminders: 0 });
    // 09:00 in São Paulo: one reminder for the reader with a due card, none for the other.
    expect(await run('2026-10-01T12:00:00Z')).toEqual({ sent: 1, reminders: 1 });
    expect(sent[0]).toMatchObject({
      to: a.token,
      channelId: 'lembretes',
      data: { url: '/revisar' },
    });
    expect((await inbox(a)).items[0]).toMatchObject({ kind: 'review_due', count: 1 });
    expect((await inbox(quiet)).items).toEqual([]);
    // Same local day again: nothing new.
    expect(await run('2026-10-01T12:30:00Z')).toEqual({ sent: 0, reminders: 0 });
    // Reminders off: nothing the next day either.
    await savePreferences(a, { reviewReminder: false });
    expect(await run('2026-10-02T12:00:00Z')).toEqual({ sent: 0, reminders: 0 });
  });
});
