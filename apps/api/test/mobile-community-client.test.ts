import { meResponseSchema } from '@bubo/contracts';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

vi.mock('../../mobile/src/lib/auth/client', () => ({ authHeaders: async () => ({}) }));
vi.mock('../../mobile/src/lib/config', () => ({
  publicConfig: { apiUrl: 'http://localhost:8787' },
}));

import { ApiError, createApiClient } from '../../mobile/src/lib/api/client';
import { createHarness } from './harness';

// The real mobile client against the real API: catches wrong paths, methods, bodies or query
// strings (a Task 05 regression came from a client URL that no test exercised).
let h: Awaited<ReturnType<typeof createHarness>>;
const calls: string[] = [];

function clientFor(cookie: string) {
  const bridge: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    calls.push(`${request.method} ${url.pathname}${url.search}`);
    const body = request.method === 'GET' ? undefined : await request.text();
    return h.call(`${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers,
      ...(body ? { body } : {}),
    });
  };
  return createApiClient({
    baseUrl: 'http://localhost:8787',
    fetch: bridge,
    getHeaders: async () => ({ cookie, 'expo-origin': 'bubo://' }),
  });
}

async function reader() {
  const { cookie } = await h.signUp();
  const me = meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
  return { cookie, id: me.user.id, api: clientFor(cookie) };
}

beforeAll(async () => {
  h = await createHarness();
}, 60_000);
afterAll(async () => {
  await h.close();
});

it('runs the whole club flow through the mobile client', async () => {
  const owner = await reader();
  const member = await reader();
  await h.database.pg.query(
    `INSERT INTO "books" ("id", "title", "total_pages", "catalog_key") VALUES ('client-book', 'Duna', 400, 'ol:client')`,
  );
  await h.database.pg.query(
    `INSERT INTO "shelf_entries" ("id", "user_id", "book_id") VALUES ('client-entry', $1, 'client-book')`,
    [owner.id],
  );

  const club = await owner.api.createClub({
    name: 'Clube do Cliente',
    icon: 'mind',
    shelfEntryId: 'client-entry',
    weeklyGoalPages: 50,
  });
  expect(club.membership).toBe('owner');
  expect((await member.api.listClubs('cliente')).discover.map((c) => c.id)).toEqual([club.id]);
  expect((await member.api.getClub(club.id)).membership).toBeNull();
  expect((await member.api.joinClub(club.id)).membership).toBe('member');

  const topic = await owner.api.createClubPost(club.id, {
    id: crypto.randomUUID(),
    title: 'Fim do livro',
    body: 'Conteúdo da página 300.',
    spoilerPage: 300,
  });
  const listed = await member.api.listClubPosts(club.id);
  expect(listed.posts[0]).toMatchObject({ id: topic.id, locked: true, body: null });
  expect((await member.api.getClubTopic(club.id, topic.id, false)).post.locked).toBe(true);
  expect((await member.api.getClubTopic(club.id, topic.id, true)).post.body).toBe(
    'Conteúdo da página 300.',
  );

  const reply = await member.api.createClubReply(club.id, topic.id, {
    id: crypto.randomUUID(),
    body: 'Resposta.',
    spoilerPage: 0,
  });
  expect(reply.spoilerPage).toBe(300);
  await member.api.deleteClubReply(club.id, reply.id);

  await member.api.reportContent({ targetType: 'post', targetId: topic.id, reason: 'spam' });
  expect((await owner.api.listClubPosts(club.id)).posts[0]?.openReportCount).toBe(1);
  expect(
    await owner.api.moderateClubContent(club.id, {
      targetType: 'post',
      targetId: topic.id,
      action: 'restore',
    }),
  ).toEqual({ status: 'visible' });

  expect((await member.api.blockUser(owner.id)).blocks.map((b) => b.userId)).toEqual([owner.id]);
  expect((await member.api.listBlocks()).blocks).toHaveLength(1);
  expect((await member.api.unblockUser(owner.id)).blocks).toEqual([]);

  await owner.api.deleteClubPost(club.id, topic.id);
  await member.api.leaveClub(club.id);
  await expect(member.api.listClubPosts(club.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await owner.api.deleteClub(club.id);
  const missing = await owner.api.getClub(club.id).catch((error: unknown) => error);
  expect(missing).toBeInstanceOf(ApiError);
  expect((missing as ApiError).code).toBe('NOT_FOUND');

  expect(calls).toEqual(
    expect.arrayContaining([
      'POST /v1/clubs',
      'GET /v1/clubs?q=cliente',
      `PUT /v1/clubs/${club.id}/membership`,
      `GET /v1/clubs/${club.id}/posts/${topic.id}?reveal=1`,
      `DELETE /v1/clubs/${club.id}/replies/${reply.id}`,
      `POST /v1/clubs/${club.id}/moderation`,
      'POST /v1/reports',
      `DELETE /v1/blocks/${owner.id}`,
      `DELETE /v1/clubs/${club.id}/membership`,
      `DELETE /v1/clubs/${club.id}`,
    ]),
  );
});
