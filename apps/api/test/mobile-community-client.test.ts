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

it('runs invites, polls, arguments, reactions, members and the feed through the mobile client', async () => {
  const owner = await reader();
  const guest = await reader();
  await h.database.pg.query(
    `INSERT INTO "books" ("id", "title", "total_pages", "catalog_key") VALUES ('client-book-2', 'Fundação', 240, 'ol:client-2')`,
  );
  await h.database.pg.query(
    `INSERT INTO "shelf_entries" ("id", "user_id", "book_id") VALUES ('client-entry-2', $1, 'client-book-2')`,
    [owner.id],
  );

  const club = await owner.api.createClub({
    name: 'Clube Privado do Cliente',
    icon: 'planet',
    shelfEntryId: 'client-entry-2',
    visibility: 'private',
  });
  const code = club.inviteCode ?? '';
  expect(code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  expect((await guest.api.listClubs('privado')).discover).toEqual([]);
  expect(await guest.api.getInvitePreview(code)).toMatchObject({ id: club.id, membership: null });
  expect((await guest.api.joinByCode(code)).membership).toBe('member');

  const poll = await owner.api.createClubPoll(club.id, {
    id: crypto.randomUUID(),
    question: 'Quem é o verdadeiro herói?',
    options: ['Hari Seldon', 'Salvor Hardin'],
    durationDays: 3,
    spoilerPage: 0,
  });
  expect((await guest.api.listClubPolls(club.id)).polls.map((p) => p.id)).toEqual([poll.id]);
  expect((await guest.api.getClubPoll(club.id, poll.id, false)).poll.resultsVisible).toBe(false);
  const optionId = poll.options[0]?.id ?? '';
  const voted = await guest.api.votePoll(club.id, poll.id, [optionId]);
  expect(voted).toMatchObject({ resultsVisible: true, voterCount: 1 });
  const argument = await guest.api.savePollArgument(club.id, poll.id, 'Ele planejou tudo.');
  expect(argument.votedFor).toEqual(['Hari Seldon']);
  expect(
    await owner.api.setReaction({
      targetType: 'argument',
      targetId: argument.id,
      kind: 'insight',
      active: true,
    }),
  ).toMatchObject({ reactions: { insight: 1 }, myReactions: ['insight'] });

  const members = await guest.api.listClubMembers(club.id);
  expect(members.members.map((m) => m.userId).sort()).toEqual([owner.id, guest.id].sort());
  const feed = await guest.api.getCommunityFeed();
  expect(feed.items.some((item) => item.type === 'poll' && item.poll.id === poll.id)).toBe(true);

  await guest.api.deletePollArgument(club.id, poll.id);
  expect((await owner.api.getClubPoll(club.id, poll.id, true)).arguments).toEqual([]);
  await owner.api.deleteClubPoll(club.id, poll.id);

  const { inviteCode } = await owner.api.regenerateInviteCode(club.id);
  expect(inviteCode).not.toBe(code);
  await expect(guest.api.getInvitePreview(code)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await owner.api.deleteClub(club.id);

  expect(calls).toEqual(
    expect.arrayContaining([
      `GET /v1/clubs/invite/${code}`,
      'POST /v1/clubs/join',
      `POST /v1/clubs/${club.id}/polls`,
      `GET /v1/clubs/${club.id}/polls/${poll.id}?reveal=1`,
      `PUT /v1/clubs/${club.id}/polls/${poll.id}/vote`,
      `PUT /v1/clubs/${club.id}/polls/${poll.id}/argument`,
      `DELETE /v1/clubs/${club.id}/polls/${poll.id}/argument`,
      'PUT /v1/reactions',
      `GET /v1/clubs/${club.id}/members`,
      'GET /v1/community/feed',
      `POST /v1/clubs/${club.id}/invite-code`,
    ]),
  );
});

it('publishes book reviews with ratings protected by spoilers, reports and blocks', async () => {
  const owner = await reader();
  const author = await reader();
  const guest = await reader();
  const outsider = await reader();
  await h.database.pg.query(
    `INSERT INTO books (id, title, total_pages, catalog_key) VALUES ('review-book', 'Livro de resenhas', 300, 'ol:reviews')`,
  );
  await h.database.pg.query(
    `INSERT INTO shelf_entries (id, user_id, book_id) VALUES ('review-entry', $1, 'review-book')`,
    [owner.id],
  );
  const club = await owner.api.createClub({
    name: 'Resenhas privadas',
    icon: 'mind',
    shelfEntryId: 'review-entry',
    visibility: 'private',
  });
  await author.api.joinByCode(club.inviteCode ?? '');
  await guest.api.joinByCode(club.inviteCode ?? '');
  const input = {
    id: crypto.randomUUID(),
    title: 'Minha leitura do final',
    body: 'Esta leitura deixou perguntas importantes sobre as escolhas dos personagens.',
    spoilerPage: 300,
    reviewRating: 4,
  };
  const review = await author.api.createClubPost(club.id, input);
  expect(review).toMatchObject({ isBookReview: true, reviewRating: 4, locked: false });
  expect((await author.api.createClubPost(club.id, input)).id).toBe(review.id);
  await owner.api.createClubPost(club.id, {
    id: crypto.randomUUID(),
    title: 'Outro debate',
    body: 'Um debate comum.',
    spoilerPage: 0,
  });
  const list = await guest.api.listClubBookReviews(club.id);
  expect(list.posts).toHaveLength(1);
  expect(list.posts[0]).toMatchObject({
    id: review.id,
    isBookReview: true,
    title: null,
    body: null,
    reviewRating: null,
    locked: true,
  });
  expect((await guest.api.getClubTopic(club.id, review.id, true)).post.reviewRating).toBe(4);
  const feedReview = (await guest.api.getCommunityFeed()).items.find(
    (item) => item.type === 'topic' && item.post.id === review.id,
  );
  expect(feedReview).toMatchObject({ post: { body: null, reviewRating: null, locked: true } });
  await expect(outsider.api.listClubBookReviews(club.id)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
  await expect(
    outsider.api.createClubPost(club.id, { ...input, id: crypto.randomUUID() }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  for (const overrides of [
    { reviewRating: 0 },
    { reviewRating: 6 },
    { reviewRating: 2.5 },
    { body: 'Curta' },
    { kind: 'question' as const },
    { spoilerPage: 301 },
  ]) {
    await expect(
      author.api.createClubPost(club.id, { ...input, ...overrides, id: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  }
  await guest.api.reportContent({ targetType: 'post', targetId: review.id, reason: 'spoiler' });
  expect((await guest.api.listClubBookReviews(club.id)).posts).toEqual([]);
  expect((await owner.api.listClubBookReviews(club.id)).posts[0]?.openReportCount).toBe(1);
  await expect(
    guest.api.moderateClubContent(club.id, {
      targetType: 'post',
      targetId: review.id,
      action: 'restore',
    }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await owner.api.moderateClubContent(club.id, {
    targetType: 'post',
    targetId: review.id,
    action: 'restore',
  });
  await outsider.api.joinByCode(club.inviteCode ?? '');
  await outsider.api.blockUser(author.id);
  expect((await outsider.api.listClubBookReviews(club.id)).posts).toEqual([]);
  await outsider.api.unblockUser(author.id);
  expect((await outsider.api.listClubBookReviews(club.id)).posts).toHaveLength(1);
  const reply = await outsider.api.createClubReply(club.id, review.id, {
    id: crypto.randomUUID(),
    body: 'Também pensei nisso.',
    spoilerPage: 0,
  });
  expect(reply.spoilerPage).toBe(300);
  await expect(guest.api.deleteClubPost(club.id, review.id)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
  await author.api.deleteClubPost(club.id, review.id);
  expect((await owner.api.listClubBookReviews(club.id)).posts).toEqual([]);
  await expect(guest.api.getClubTopic(club.id, review.id, true)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
  await owner.api.deleteClub(club.id);
});
