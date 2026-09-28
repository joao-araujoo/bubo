import {
  blocksResponseSchema,
  clubDetailSchema,
  clubPostSchema,
  clubPostsResponseSchema,
  clubReplySchema,
  clubsResponseSchema,
  clubTopicResponseSchema,
  errorResponseSchema,
  meResponseSchema,
  shelfEntrySchema,
  shelfResponseSchema,
} from '@bubo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

let h: Awaited<ReturnType<typeof createHarness>>;
beforeAll(async () => {
  h = await createHarness();
}, 60_000);
afterAll(async () => {
  await h.close();
});

let bookCounter = 0;

type Reader = { cookie: string; id: string };

async function reader(): Promise<Reader> {
  const { cookie } = await h.signUp();
  const me = meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
  return { cookie, id: me.user.id };
}

/** Seeds a shared catalog book (catalog fetch is disabled in tests) and shelves it. */
async function catalogBookOnShelf(owner: Reader, totalPages: number | null = 300) {
  bookCounter += 1;
  const bookId = `test-book-${bookCounter}`;
  await h.database.pg.query(
    `INSERT INTO "books" ("id", "title", "author", "total_pages", "catalog_key") VALUES ($1, $2, 'Frank Herbert', $3, $4)`,
    [bookId, `Duna ${bookCounter}`, totalPages, `ol:test${bookCounter}`],
  );
  const entryId = `test-entry-${bookCounter}`;
  await h.database.pg.query(
    `INSERT INTO "shelf_entries" ("id", "user_id", "book_id", "status") VALUES ($1, $2, $3, 'reading')`,
    [entryId, owner.id, bookId],
  );
  return { bookId, entryId };
}

async function createClub(owner: Reader, overrides: Record<string, unknown> = {}) {
  const { entryId, bookId } = await catalogBookOnShelf(owner);
  const response = await h.call('/v1/clubs', {
    method: 'POST',
    cookie: owner.cookie,
    json: { name: 'Círculo Sci-Fi', icon: 'planet', shelfEntryId: entryId, ...overrides },
  });
  expect(response.status).toBe(201);
  return { club: clubDetailSchema.parse(await response.json()), bookId, entryId };
}

const join = (member: Reader, clubId: string, json: unknown = { acceptGuidelines: true }) =>
  h.call(`/v1/clubs/${clubId}/membership`, { method: 'PUT', cookie: member.cookie, json });

async function setPage(member: Reader, bookId: string, page: number) {
  const shelf = shelfResponseSchema.parse(
    await (await h.call('/v1/shelf', { cookie: member.cookie })).json(),
  );
  const entry = shelf.entries.find((e) => e.book.id === bookId);
  if (!entry) throw new Error('book not on shelf');
  const response = await h.call(`/v1/shelf/${entry.id}`, {
    method: 'PATCH',
    cookie: member.cookie,
    json: { currentPage: page },
  });
  expect(response.status).toBe(200);
}

const post = (author: Reader, clubId: string, json: Record<string, unknown>) =>
  h.call(`/v1/clubs/${clubId}/posts`, {
    method: 'POST',
    cookie: author.cookie,
    json: { id: crypto.randomUUID(), title: 'A presciência de Paul', body: 'Reflexão.', ...json },
  });

const topics = async (member: Reader, clubId: string) =>
  clubPostsResponseSchema.parse(
    await (await h.call(`/v1/clubs/${clubId}/posts`, { cookie: member.cookie })).json(),
  );

const report = (member: Reader, targetId: string, targetType = 'post') =>
  h.call('/v1/reports', {
    method: 'POST',
    cookie: member.cookie,
    json: { targetType, targetId, reason: 'spoiler' },
  });

describe('reading_clubs', () => {
  it('requires a session', async () => {
    expect((await h.call('/v1/clubs')).status).toBe(401);
    expect((await h.call('/v1/blocks')).status).toBe(401);
    expect((await h.call('/v1/reports', { method: 'POST', json: {} })).status).toBe(401);
  });

  it('creates a club around a catalog book and makes the creator its owner', async () => {
    const owner = await reader();
    const { club, bookId } = await createClub(owner, {
      description: 'Futuros especulativos.',
      weeklyGoalPages: 75,
    });
    expect(club).toMatchObject({
      name: 'Círculo Sci-Fi',
      description: 'Futuros especulativos.',
      icon: 'planet',
      weeklyGoalPages: 75,
      memberCount: 1,
      topicCount: 0,
      membership: 'owner',
      readerPage: 0,
      openReports: 0,
    });
    expect(club.book).toMatchObject({ id: bookId, author: 'Frank Herbert', totalPages: 300 });
  });

  it('refuses manual books, unknown shelf entries and invalid fields', async () => {
    const owner = await reader();
    const manual = shelfEntrySchema.parse(
      await (
        await h.call('/v1/shelf', { method: 'POST', cookie: owner.cookie, json: { title: 'Meu' } })
      ).json(),
    );
    const refused = await h.call('/v1/clubs', {
      method: 'POST',
      cookie: owner.cookie,
      json: { name: 'Clube', icon: 'planet', shelfEntryId: manual.id },
    });
    expect(refused.status).toBe(422);
    expect(errorResponseSchema.parse(await refused.json()).error.issues?.[0]?.path).toBe(
      'shelfEntryId',
    );
    const stranger = await reader();
    const { entryId } = await catalogBookOnShelf(stranger);
    expect(
      (
        await h.call('/v1/clubs', {
          method: 'POST',
          cookie: owner.cookie,
          json: { name: 'Clube', icon: 'planet', shelfEntryId: entryId },
        })
      ).status,
    ).toBe(404);
    for (const json of [
      { name: 'ab', icon: 'planet', shelfEntryId: entryId },
      { name: 'Clube', icon: 'emoji', shelfEntryId: entryId },
      { name: 'Clube', icon: 'planet', shelfEntryId: entryId, weeklyGoalPages: 60 },
    ]) {
      expect(
        (await h.call('/v1/clubs', { method: 'POST', cookie: stranger.cookie, json })).status,
      ).toBe(422);
    }
  });

  it('limits how many clubs one reader owns', async () => {
    const owner = await reader();
    for (let i = 0; i < 5; i += 1) await createClub(owner);
    const { entryId } = await catalogBookOnShelf(owner);
    const response = await h.call('/v1/clubs', {
      method: 'POST',
      cookie: owner.cookie,
      json: { name: 'Sexto clube', icon: 'mind', shelfEntryId: entryId },
    });
    expect(response.status).toBe(409);
  });

  it('lists my clubs apart from clubs to discover, and searches by name or book', async () => {
    const owner = await reader();
    const { club } = await createClub(owner, { name: 'Leitores de Arrakis' });
    const visitor = await reader();
    const list = async (who: Reader, q = '') =>
      clubsResponseSchema.parse(
        await (await h.call(`/v1/clubs?q=${encodeURIComponent(q)}`, { cookie: who.cookie })).json(),
      );
    expect((await list(owner)).mine.map((c) => c.id)).toContain(club.id);
    const before = await list(visitor, 'arrakis');
    expect(before.mine).toEqual([]);
    expect(before.discover.map((c) => c.id)).toEqual([club.id]);
    expect(before.discover[0]?.membership).toBeNull();
    expect((await list(visitor, club.book.title)).discover.map((c) => c.id)).toContain(club.id);
    // LIKE wildcards are literal text.
    expect((await list(visitor, '%')).discover).toEqual([]);
    expect((await join(visitor, club.id)).status).toBe(200);
    expect((await list(visitor, 'arrakis')).mine.map((c) => c.id)).toEqual([club.id]);
  });

  it('joins only with the guidelines accepted, shelves the book and stays idempotent', async () => {
    const owner = await reader();
    const { club, bookId } = await createClub(owner);
    const member = await reader();
    const detail = clubDetailSchema.parse(
      await (await h.call(`/v1/clubs/${club.id}`, { cookie: member.cookie })).json(),
    );
    expect(detail).toMatchObject({ membership: null, readerPage: null, openReports: null });
    expect((await h.call(`/v1/clubs/${club.id}/posts`, { cookie: member.cookie })).status).toBe(
      403,
    );
    expect((await join(member, club.id, {})).status).toBe(422);
    expect((await join(member, club.id, { acceptGuidelines: false })).status).toBe(422);
    const joined = clubDetailSchema.parse(await (await join(member, club.id)).json());
    expect(joined).toMatchObject({ membership: 'member', memberCount: 2, readerPage: 0 });
    expect(clubDetailSchema.parse(await (await join(member, club.id)).json()).memberCount).toBe(2);
    const shelf = shelfResponseSchema.parse(
      await (await h.call('/v1/shelf', { cookie: member.cookie })).json(),
    );
    expect(shelf.entries.filter((e) => e.book.id === bookId)).toHaveLength(1);
    expect((await h.call('/v1/clubs/unknown', { cookie: member.cookie })).status).toBe(404);
  });

  it('lets members leave, never the owner; only the owner deletes', async () => {
    const owner = await reader();
    const { club } = await createClub(owner);
    const member = await reader();
    await join(member, club.id);
    const leave = (who: Reader) =>
      h.call(`/v1/clubs/${club.id}/membership`, { method: 'DELETE', cookie: who.cookie });
    expect((await leave(owner)).status).toBe(409);
    expect(
      (await h.call(`/v1/clubs/${club.id}`, { method: 'DELETE', cookie: member.cookie })).status,
    ).toBe(403);
    expect((await leave(member)).status).toBe(200);
    expect((await h.call(`/v1/clubs/${club.id}/posts`, { cookie: member.cookie })).status).toBe(
      403,
    );
    expect(
      (await h.call(`/v1/clubs/${club.id}`, { method: 'DELETE', cookie: owner.cookie })).status,
    ).toBe(200);
    expect((await h.call(`/v1/clubs/${club.id}`, { cookie: owner.cookie })).status).toBe(404);
  });
});

describe('anti-spoiler debates', () => {
  it('never sends content beyond the reader page unless they choose to peek', async () => {
    const owner = await reader();
    const { club, bookId } = await createClub(owner);
    const member = await reader();
    await join(member, club.id);
    const created = await post(owner, club.id, {
      title: 'O jantar em Arrakeen',
      body: 'Detalhe da página 120.',
      spoilerPage: 120,
    });
    expect(created.status).toBe(201);
    const topic = clubPostSchema.parse(await created.json());
    expect(topic).toMatchObject({ isMine: true, locked: false, title: 'O jantar em Arrakeen' });

    const locked = await topics(member, club.id);
    expect(locked.readerPage).toBe(0);
    expect(locked.posts[0]).toMatchObject({
      id: topic.id,
      locked: true,
      title: null,
      body: null,
      spoilerPage: 120,
      openReportCount: null,
    });
    expect(JSON.stringify(locked)).not.toContain('Arrakeen');

    const hidden = clubTopicResponseSchema.parse(
      await (
        await h.call(`/v1/clubs/${club.id}/posts/${topic.id}`, { cookie: member.cookie })
      ).json(),
    );
    expect(hidden.post.locked).toBe(true);
    const peeked = clubTopicResponseSchema.parse(
      await (
        await h.call(`/v1/clubs/${club.id}/posts/${topic.id}?reveal=1`, { cookie: member.cookie })
      ).json(),
    );
    expect(peeked).toMatchObject({
      revealed: true,
      post: { locked: false, body: 'Detalhe da página 120.' },
    });

    await setPage(member, bookId, 120);
    const unlocked = await topics(member, club.id);
    expect(unlocked.posts[0]).toMatchObject({ locked: false, title: 'O jantar em Arrakeen' });
  });

  it('validates the page against the book and keeps retries idempotent', async () => {
    const owner = await reader();
    const { club } = await createClub(owner);
    expect((await post(owner, club.id, { spoilerPage: 301 })).status).toBe(422);
    expect((await post(owner, club.id, { spoilerPage: 10, title: 'ab' })).status).toBe(422);
    const id = crypto.randomUUID();
    expect((await post(owner, club.id, { id, spoilerPage: 10 })).status).toBe(201);
    expect((await post(owner, club.id, { id, spoilerPage: 10 })).status).toBe(200);
    expect((await topics(owner, club.id)).posts).toHaveLength(1);
    const member = await reader();
    await join(member, club.id);
    expect((await post(member, club.id, { id, spoilerPage: 10 })).status).toBe(409);
  });

  it('replies inherit at least the topic page and lock for readers behind', async () => {
    const owner = await reader();
    const { club, bookId } = await createClub(owner);
    const member = await reader();
    await join(member, club.id);
    await setPage(member, bookId, 50);
    const topic = clubPostSchema.parse(
      await (await post(member, club.id, { spoilerPage: 40 })).json(),
    );
    const replyId = crypto.randomUUID();
    const reply = await h.call(`/v1/clubs/${club.id}/posts/${topic.id}/replies`, {
      method: 'POST',
      cookie: owner.cookie,
      json: { id: replyId, body: 'Resposta que não pode ser menos spoiler.', spoilerPage: 5 },
    });
    expect(reply.status).toBe(201);
    expect(clubReplySchema.parse(await reply.json()).spoilerPage).toBe(40);
    const retry = await h.call(`/v1/clubs/${club.id}/posts/${topic.id}/replies`, {
      method: 'POST',
      cookie: owner.cookie,
      json: { id: replyId, body: 'x', spoilerPage: 5 },
    });
    expect(retry.status).toBe(200);
    const later = await h.call(`/v1/clubs/${club.id}/posts/${topic.id}/replies`, {
      method: 'POST',
      cookie: owner.cookie,
      json: { id: crypto.randomUUID(), body: 'Isso só acontece no fim.', spoilerPage: 250 },
    });
    expect(later.status).toBe(201);
    const view = clubTopicResponseSchema.parse(
      await (
        await h.call(`/v1/clubs/${club.id}/posts/${topic.id}`, { cookie: member.cookie })
      ).json(),
    );
    expect(view.replies.map((r) => [r.spoilerPage, r.locked])).toEqual([
      [40, false],
      [250, true],
    ]);
    expect(view.replies[1]?.body).toBeNull();
    expect((await topics(member, club.id)).posts[0]?.replyCount).toBe(2);
  });

  it('keeps topics inside their club', async () => {
    const owner = await reader();
    const first = await createClub(owner);
    const second = await createClub(owner);
    const topic = clubPostSchema.parse(
      await (await post(owner, first.club.id, { spoilerPage: 0 })).json(),
    );
    expect(
      (await h.call(`/v1/clubs/${second.club.id}/posts/${topic.id}`, { cookie: owner.cookie }))
        .status,
    ).toBe(404);
    expect(
      (
        await h.call(`/v1/clubs/${second.club.id}/posts/${topic.id}`, {
          method: 'DELETE',
          cookie: owner.cookie,
        })
      ).status,
    ).toBe(404);
  });
});

describe('moderation, reports and blocks', () => {
  it('hides content after three reports and lets the owner review it', async () => {
    const owner = await reader();
    const { club } = await createClub(owner);
    const author = await reader();
    const members = [await reader(), await reader(), await reader(), await reader()];
    for (const who of [author, ...members]) await join(who, club.id);
    const topic = clubPostSchema.parse(
      await (await post(author, club.id, { spoilerPage: 0 })).json(),
    );

    expect((await report(author, topic.id)).status).toBe(422);
    const outsider = await reader();
    expect((await report(outsider, topic.id)).status).toBe(403);

    const [first, second, third, bystander] = members as [Reader, Reader, Reader, Reader];
    expect((await report(first, topic.id)).status).toBe(200);
    expect((await report(first, topic.id)).status).toBe(200);
    // The reporter stops seeing it at once; others still do until the threshold.
    expect((await topics(first, club.id)).posts).toEqual([]);
    expect((await topics(bystander, club.id)).posts).toHaveLength(1);
    const ownerView = await topics(owner, club.id);
    expect(ownerView.posts[0]).toMatchObject({ moderation: 'visible', openReportCount: 1 });

    await report(second, topic.id);
    await report(third, topic.id);
    expect((await topics(bystander, club.id)).posts).toEqual([]);
    expect((await topics(author, club.id)).posts[0]?.moderation).toBe('hidden');
    expect((await topics(owner, club.id)).posts[0]).toMatchObject({
      moderation: 'hidden',
      openReportCount: 3,
    });
    const detail = clubDetailSchema.parse(
      await (await h.call(`/v1/clubs/${club.id}`, { cookie: owner.cookie })).json(),
    );
    expect(detail.openReports).toBe(3);

    const moderate = (who: Reader, action: string) =>
      h.call(`/v1/clubs/${club.id}/moderation`, {
        method: 'POST',
        cookie: who.cookie,
        json: { targetType: 'post', targetId: topic.id, action },
      });
    expect((await moderate(bystander, 'restore')).status).toBe(403);
    expect((await moderate(owner, 'restore')).status).toBe(200);
    expect((await topics(bystander, club.id)).posts).toHaveLength(1);
    expect((await topics(owner, club.id)).posts[0]?.openReportCount).toBe(0);

    expect((await moderate(owner, 'remove')).status).toBe(200);
    expect((await topics(author, club.id)).posts).toEqual([]);
    expect((await topics(owner, club.id)).posts).toEqual([]);
    expect((await report(bystander, topic.id)).status).toBe(404);
  });

  it('lets authors delete their own content and the owner remove anyone else’s', async () => {
    const owner = await reader();
    const { club } = await createClub(owner);
    const author = await reader();
    const other = await reader();
    await join(author, club.id);
    await join(other, club.id);
    const mine = clubPostSchema.parse(
      await (await post(author, club.id, { spoilerPage: 0 })).json(),
    );
    const theirs = clubPostSchema.parse(
      await (await post(other, club.id, { spoilerPage: 0 })).json(),
    );
    const remove = (who: Reader, id: string) =>
      h.call(`/v1/clubs/${club.id}/posts/${id}`, { method: 'DELETE', cookie: who.cookie });
    expect((await remove(author, theirs.id)).status).toBe(403);
    expect((await remove(author, mine.id)).status).toBe(200);
    expect((await remove(owner, theirs.id)).status).toBe(200);
    expect((await topics(owner, club.id)).posts).toEqual([]);
    const { rows } = await h.database.pg.query<{ status: string }>(
      `SELECT "status" FROM "reading_club_posts" WHERE "id" = ANY($1)`,
      [[mine.id, theirs.id]],
    );
    // The author's own delete is permanent; the owner's removal is kept as "removed".
    expect(rows).toEqual([{ status: 'removed' }]);
  });

  it('blocks a reader: their content disappears only for the blocker', async () => {
    const owner = await reader();
    const { club } = await createClub(owner);
    const annoying = await reader();
    const me = await reader();
    await join(annoying, club.id);
    await join(me, club.id);
    await post(annoying, club.id, { spoilerPage: 0 });
    expect((await topics(me, club.id)).posts).toHaveLength(1);

    const block = await h.call('/v1/blocks', {
      method: 'POST',
      cookie: me.cookie,
      json: { userId: annoying.id },
    });
    expect(block.status).toBe(200);
    expect(blocksResponseSchema.parse(await block.json()).blocks.map((b) => b.userId)).toEqual([
      annoying.id,
    ]);
    expect((await topics(me, club.id)).posts).toEqual([]);
    expect((await topics(owner, club.id)).posts).toHaveLength(1);
    expect(
      (await h.call('/v1/blocks', { method: 'POST', cookie: me.cookie, json: { userId: me.id } }))
        .status,
    ).toBe(422);
    expect(
      (
        await h.call('/v1/blocks', {
          method: 'POST',
          cookie: me.cookie,
          json: { userId: 'nobody' },
        })
      ).status,
    ).toBe(404);

    const unblocked = await h.call(`/v1/blocks/${annoying.id}`, {
      method: 'DELETE',
      cookie: me.cookie,
    });
    expect(blocksResponseSchema.parse(await unblocked.json()).blocks).toEqual([]);
    expect((await topics(me, club.id)).posts).toHaveLength(1);
  });

  it('removes a deleted account’s clubs and content', async () => {
    const owner = await reader();
    const { club } = await createClub(owner);
    const member = await reader();
    await join(member, club.id);
    await post(owner, club.id, { spoilerPage: 0 });
    const deleted = await h.call('/v1/auth/delete-user', {
      method: 'POST',
      cookie: owner.cookie,
      json: { password: 'senha-forte-123' },
    });
    expect(deleted.status).toBe(200);
    expect((await h.call(`/v1/clubs/${club.id}`, { cookie: member.cookie })).status).toBe(404);
    const { rows } = await h.database.pg.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "reading_club_posts" WHERE "club_id" = $1`,
      [club.id],
    );
    expect(rows[0]?.n).toBe(0);
  });
});
