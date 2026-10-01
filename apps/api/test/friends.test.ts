import {
  clubDetailSchema,
  friendsFeedSchema,
  friendsResponseSchema,
  meResponseSchema,
  shelfResponseSchema,
} from '@bubo/contracts';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
let now = new Date('2026-09-30T10:00:00Z');
beforeAll(async () => {
  h = await createHarness({ now: () => now });
}, 60000);
afterAll(async () => {
  await h.close();
});

it('requires mutual consent and opt-in; blocks revoke friendship and stop future requests', async () => {
  async function reader() {
    const { cookie } = await h.signUp();
    const me = meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
    return { cookie, id: me.user.id };
  }
  const a = await reader();
  const b = await reader();
  const outsider = await reader();
  const change = (from: typeof a, to: typeof a, action: string) =>
    h.call(`/v1/community/friends/${to.id}`, {
      method: 'PUT',
      cookie: from.cookie,
      json: { action },
    });
  const list = async (who: typeof a) =>
    friendsResponseSchema.parse(
      await (await h.call('/v1/community/friends', { cookie: who.cookie })).json(),
    );
  const feed = async (who: typeof a) =>
    friendsFeedSchema.parse(
      await (await h.call('/v1/community/friends-feed', { cookie: who.cookie })).json(),
    );
  const prefs = (who: typeof a, shareActivity: boolean, allowRequests = true) =>
    h.call('/v1/me/social-preferences', {
      method: 'PUT',
      cookie: who.cookie,
      json: { shareActivity, allowRequests },
    });
  expect((await h.call('/v1/community/friends')).status).toBe(401);
  expect((await h.call('/v1/community/friends-feed')).status).toBe(401);
  expect((await change(a, a, 'request')).status).toBe(422);
  expect((await change(a, outsider, 'request')).status).toBe(404);
  expect((await list(a)).preferences).toEqual({ allowRequests: true, shareActivity: false });
  await h.database.pg.query(
    `INSERT INTO books (id, title, total_pages, catalog_key) VALUES ('friend-book', 'Livro compartilhado', 300, 'ol:friend')`,
  );
  await h.database.pg.query(
    `INSERT INTO shelf_entries (id, user_id, book_id) VALUES ('friend-entry', $1, 'friend-book')`,
    [a.id],
  );
  const club = clubDetailSchema.parse(
    await (
      await h.call('/v1/clubs', {
        method: 'POST',
        cookie: a.cookie,
        json: { name: 'Amigos leitores', icon: 'mind', shelfEntryId: 'friend-entry' },
      })
    ).json(),
  );
  await h.call(`/v1/clubs/${club.id}/membership`, {
    method: 'PUT',
    cookie: b.cookie,
    json: { acceptGuidelines: true },
  });
  expect((await change(a, b, 'request')).status).toBe(200);
  await change(a, b, 'request');
  await change(b, a, 'request');
  expect((await list(a)).friends).toEqual([
    { userId: b.id, name: 'Leitora Teste', status: 'outgoing' },
  ]);
  expect((await list(b)).friends[0]?.status).toBe('incoming');
  expect((await change(a, b, 'accept')).status).toBe(404);
  expect((await change(outsider, a, 'accept')).status).toBe(404);
  expect((await change(b, a, 'accept')).status).toBe(200);
  expect((await list(a)).friends[0]?.status).toBe('accepted');
  const entries = shelfResponseSchema.parse(
    await (await h.call('/v1/shelf', { cookie: b.cookie })).json(),
  );
  const entryId = entries.entries.find((entry) => entry.book.id === 'friend-book')?.id ?? '';
  const record = (start: string, end: string, endPage: number) =>
    h.call('/v1/sessions', {
      method: 'POST',
      cookie: b.cookie,
      json: {
        id: crypto.randomUUID(),
        shelfEntryId: entryId,
        startedAt: start,
        endedAt: end,
        focusedSeconds: 600,
        endPage,
        reflection: 'REFLEXAO_PRIVADA_NUNCA_NO_FEED',
        localDate: '2026-09-30',
      },
    });
  now = new Date('2026-09-30T11:00:00Z');
  expect((await record('2026-09-30T10:10:00Z', '2026-09-30T10:20:00Z', 10)).status).toBe(201);
  expect((await feed(a)).items).toEqual([]);
  await prefs(b, true);
  expect((await feed(a)).items).toEqual([]);
  now = new Date('2026-09-30T12:00:00Z');
  expect((await record('2026-09-30T11:10:00Z', '2026-09-30T11:20:00Z', 20)).status).toBe(201);
  const shared = await feed(a);
  expect(shared.items).toHaveLength(1);
  expect(shared.items[0]).toMatchObject({
    userId: b.id,
    bookTitle: 'Livro compartilhado',
    pages: 10,
    minutes: 10,
  });
  expect(JSON.stringify(shared)).not.toContain('REFLEXAO_PRIVADA');
  expect((await feed(outsider)).items).toEqual([]);
  await prefs(b, false);
  expect((await feed(a)).items).toEqual([]);
  await prefs(b, true);
  expect((await feed(a)).items).toEqual([]);
  expect(
    (await h.call('/v1/blocks', { method: 'POST', cookie: b.cookie, json: { userId: a.id } }))
      .status,
  ).toBe(200);
  expect((await list(a)).friends).toEqual([]);
  expect((await feed(a)).items).toEqual([]);
  expect((await change(a, b, 'request')).status).toBe(404);
  expect((await change(b, a, 'request')).status).toBe(404);
  await h.call(`/v1/blocks/${a.id}`, { method: 'DELETE', cookie: b.cookie });
  expect((await list(a)).friends).toEqual([]);
  await prefs(b, false, false);
  expect((await change(a, b, 'request')).status).toBe(404);
  await prefs(b, false, true);
  await change(a, b, 'request');
  await prefs(b, false, false);
  expect((await list(a)).friends).toEqual([]);
});
