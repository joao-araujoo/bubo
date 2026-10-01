import {
  clubDetailSchema,
  clubPostSchema,
  meResponseSchema,
  moderationQueueSchema,
} from '@bubo/contracts';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { isModerator } from '../src/services/moderation';
import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
beforeAll(async () => {
  h = await createHarness();
}, 60000);
afterAll(async () => {
  await h.close();
});

it('authorizes exact configured ids only', () => {
  expect(isModerator('ana', undefined)).toBe(false);
  expect(isModerator('', ',')).toBe(false);
  expect(isModerator('ana', 'joana, anabela')).toBe(false);
  expect(isModerator('ana', ' bob, ana ')).toBe(true);
});

it('keeps reported private club content behind moderator authorization and explicit reveal', async () => {
  const admin = await h.signUp();
  const owner = await h.signUp();
  const member = await h.signUp();
  const me = async (cookie: string) =>
    meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
  const adminId = (await me(admin.cookie)).user.id;
  const ownerId = (await me(owner.cookie)).user.id;
  await h.database.pg.query(
    `INSERT INTO books (id, title, total_pages, catalog_key) VALUES ('mod-book', 'Livro', 100, 'ol:mod')`,
  );
  await h.database.pg.query(
    `INSERT INTO shelf_entries (id, user_id, book_id) VALUES ('mod-entry', $1, 'mod-book')`,
    [ownerId],
  );
  const club = clubDetailSchema.parse(
    await (
      await h.call('/v1/clubs', {
        method: 'POST',
        cookie: owner.cookie,
        json: {
          name: 'Clube privado',
          icon: 'mind',
          visibility: 'private',
          shelfEntryId: 'mod-entry',
        },
      })
    ).json(),
  );
  await h.call('/v1/clubs/join', {
    method: 'POST',
    cookie: member.cookie,
    json: { code: club.inviteCode, acceptGuidelines: true },
  });
  const post = clubPostSchema.parse(
    await (
      await h.call(`/v1/clubs/${club.id}/posts`, {
        method: 'POST',
        cookie: owner.cookie,
        json: {
          id: crypto.randomUUID(),
          title: 'Resenha denunciada',
          body: 'Um conteúdo de teste com trinta caracteres ou mais.',
          reviewRating: 3,
          spoilerPage: 100,
        },
      })
    ).json(),
  );
  await h.call('/v1/reports', {
    method: 'POST',
    cookie: member.cookie,
    json: { targetType: 'post', targetId: post.id, reason: 'spoiler' },
  });
  expect((await h.call('/v1/me/moderation')).status).toBe(401);
  expect((await h.call('/v1/me/moderation?reveal=1', { cookie: owner.cookie })).status).toBe(403);
  expect((await h.call('/v1/me/moderation', { cookie: admin.cookie })).status).toBe(403);
  h.bindings.MODERATOR_USER_IDS = adminId;
  expect((await me(admin.cookie)).isModerator).toBe(true);
  expect((await me(owner.cookie)).isModerator).toBe(false);
  const queue = async (reveal = false) =>
    moderationQueueSchema.parse(
      await (
        await h.call(`/v1/me/moderation${reveal ? '?reveal=1' : ''}`, { cookie: admin.cookie })
      ).json(),
    );
  expect((await queue()).items[0]).toMatchObject({
    targetId: post.id,
    body: null,
    reportCount: 1,
    reasons: ['spoiler'],
  });
  expect((await queue(true)).items[0]?.body).toContain('trinta caracteres');
  const decision = { clubId: club.id, targetType: 'post', targetId: post.id, action: 'remove' };
  expect(
    (
      await h.call('/v1/me/moderation', {
        method: 'POST',
        cookie: owner.cookie,
        json: { ...decision, globalModerator: true },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await h.call('/v1/me/moderation', {
        method: 'POST',
        cookie: admin.cookie,
        json: { ...decision, clubId: 'other' },
      })
    ).status,
  ).toBe(404);
  expect(
    (await h.call('/v1/me/moderation', { method: 'POST', cookie: admin.cookie, json: decision }))
      .status,
  ).toBe(200);
  expect((await queue()).items).toEqual([]);
  expect(
    (await h.call(`/v1/clubs/${club.id}/posts/${post.id}?reveal=1`, { cookie: owner.cookie }))
      .status,
  ).toBe(404);
  expect(h.logs.lines.join('\n')).toContain('global moderation');
  expect(h.logs.lines.join('\n')).not.toContain('trinta caracteres');
  h.bindings.MODERATOR_USER_IDS = undefined;
  expect((await h.call('/v1/me/moderation?reveal=1', { cookie: admin.cookie })).status).toBe(403);
});
