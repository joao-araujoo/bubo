import {
  clubDetailSchema,
  clubMembersResponseSchema,
  clubsResponseSchema,
  communityFeedResponseSchema,
  inviteCodeResponseSchema,
  invitePreviewSchema,
  meResponseSchema,
  memoryStatsResponseSchema,
  recallCardSchema,
  shelfEntryDetailSchema,
  shelfEntrySchema,
  shelfResponseSchema,
} from '@bubo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

let now = new Date('2026-09-27T15:00:00.000Z');
let h: Awaited<ReturnType<typeof createHarness>>;
beforeAll(async () => {
  h = await createHarness({ now: () => now });
}, 60_000);
afterAll(async () => {
  await h.close();
});

type Reader = { cookie: string; id: string };
let counter = 0;

async function reader(): Promise<Reader> {
  const { cookie } = await h.signUp();
  const me = meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json());
  return { cookie, id: me.user.id };
}

async function club(owner: Reader, extra: Record<string, unknown> = {}, totalPages = 400) {
  counter += 1;
  await h.database.pg.query(
    `INSERT INTO "books" ("id", "title", "total_pages", "catalog_key") VALUES ($1, $2, $3, $4)`,
    [`c2-book-${counter}`, `Livro ${counter}`, totalPages, `ol:c2-${counter}`],
  );
  await h.database.pg.query(
    `INSERT INTO "shelf_entries" ("id", "user_id", "book_id") VALUES ($1, $2, $3)`,
    [`c2-entry-${counter}`, owner.id, `c2-book-${counter}`],
  );
  const response = await h.call('/v1/clubs', {
    method: 'POST',
    cookie: owner.cookie,
    json: {
      name: `Clube ${counter}`,
      icon: 'library',
      shelfEntryId: `c2-entry-${counter}`,
      ...extra,
    },
  });
  expect(response.status).toBe(201);
  return { club: clubDetailSchema.parse(await response.json()), bookId: `c2-book-${counter}` };
}

const join = (who: Reader, clubId: string) =>
  h.call(`/v1/clubs/${clubId}/membership`, {
    method: 'PUT',
    cookie: who.cookie,
    json: { acceptGuidelines: true },
  });

async function setPage(who: Reader, bookId: string, page: number) {
  const shelf = shelfResponseSchema.parse(
    await (await h.call('/v1/shelf', { cookie: who.cookie })).json(),
  );
  const entry = shelf.entries.find((e) => e.book.id === bookId);
  if (!entry) throw new Error('not shelved');
  expect(
    (
      await h.call(`/v1/shelf/${entry.id}`, {
        method: 'PATCH',
        cookie: who.cookie,
        json: { currentPage: page },
      })
    ).status,
  ).toBe(200);
}

describe('private clubs and invites', () => {
  it('keeps private clubs out of discovery and reachable only by code', async () => {
    const owner = await reader();
    const { club: c } = await club(owner, { visibility: 'private', name: 'Clube Secreto' });
    expect(c).toMatchObject({ visibility: 'private', membership: 'owner' });
    expect(c.inviteCode).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);

    const outsider = await reader();
    const listed = clubsResponseSchema.parse(
      await (await h.call('/v1/clubs?q=Secreto', { cookie: outsider.cookie })).json(),
    );
    expect(listed.discover).toEqual([]);
    expect((await h.call(`/v1/clubs/${c.id}`, { cookie: outsider.cookie })).status).toBe(404);
    expect((await join(outsider, c.id)).status).toBe(404);

    const code = c.inviteCode ?? '';
    const preview = await h.call(`/v1/clubs/invite/${code.toLowerCase()}`, {
      cookie: outsider.cookie,
    });
    expect(preview.status).toBe(200);
    expect(invitePreviewSchema.parse(await preview.json())).toMatchObject({
      id: c.id,
      membership: null,
    });
    expect((await h.call('/v1/clubs/invite/ABCD2345', { cookie: outsider.cookie })).status).toBe(
      404,
    );
    expect((await h.call('/v1/clubs/invite/bad', { cookie: outsider.cookie })).status).toBe(404);

    const joined = await h.call('/v1/clubs/join', {
      method: 'POST',
      cookie: outsider.cookie,
      json: { code: `bubo://convite/${code.slice(0, 4)}-${code.slice(4)}`, acceptGuidelines: true },
    });
    expect(joined.status).toBe(200);
    const detail = clubDetailSchema.parse(await joined.json());
    expect(detail).toMatchObject({ membership: 'member', inviteCode: code });
    expect(detail.joinedAt).not.toBeNull();

    // Only the owner replaces the code; the old one stops working.
    expect(
      (await h.call(`/v1/clubs/${c.id}/invite-code`, { method: 'POST', cookie: outsider.cookie }))
        .status,
    ).toBe(403);
    const fresh = inviteCodeResponseSchema.parse(
      await (
        await h.call(`/v1/clubs/${c.id}/invite-code`, { method: 'POST', cookie: owner.cookie })
      ).json(),
    );
    expect(fresh.inviteCode).not.toBe(code);
    const late = await reader();
    expect((await h.call(`/v1/clubs/invite/${code}`, { cookie: late.cookie })).status).toBe(404);
    expect(
      (
        await h.call('/v1/clubs/join', {
          method: 'POST',
          cookie: late.cookie,
          json: { code: fresh.inviteCode, acceptGuidelines: true },
        })
      ).status,
    ).toBe(200);
  });

  it('reports shelf affinity and the reader page on club summaries', async () => {
    const owner = await reader();
    const { club: c, bookId } = await club(owner, { name: 'Afinidade Teste' });
    const visitor = await reader();
    const before = clubsResponseSchema.parse(
      await (await h.call('/v1/clubs?q=Afinidade', { cookie: visitor.cookie })).json(),
    );
    expect(before.discover[0]).toMatchObject({
      onMyShelf: false,
      myPage: null,
      ownerName: 'Leitora Teste',
    });
    await h.database.pg.query(
      `INSERT INTO "shelf_entries" ("id", "user_id", "book_id", "current_page") VALUES ($1, $2, $3, 42)`,
      [`aff-${counter}`, visitor.id, bookId],
    );
    const after = clubsResponseSchema.parse(
      await (await h.call('/v1/clubs?q=Afinidade', { cookie: visitor.cookie })).json(),
    );
    expect(after.discover[0]).toMatchObject({ id: c.id, onMyShelf: true, myPage: 42 });
  });
});

describe('members', () => {
  it('lists members with their page, level and the page distribution (members only)', async () => {
    const owner = await reader();
    const { club: c, bookId } = await club(owner);
    const a = await reader();
    const b = await reader();
    await join(a, c.id);
    await join(b, c.id);
    await setPage(owner, bookId, 400);
    await setPage(a, bookId, 150);
    await setPage(b, bookId, 20);
    expect(
      (await h.call(`/v1/clubs/${c.id}/members`, { cookie: (await reader()).cookie })).status,
    ).toBe(403);
    const result = clubMembersResponseSchema.parse(
      await (await h.call(`/v1/clubs/${c.id}/members`, { cookie: a.cookie })).json(),
    );
    expect(result.members.map((m) => [m.page, m.role, m.isYou])).toEqual([
      [400, 'owner', false],
      [150, 'member', true],
      [20, 'member', false],
    ]);
    expect(result.members[1]).toMatchObject({ percent: 38, level: 1 });
    expect(result.readerPage).toBe(150);
    expect(result.averagePercent).toBe(48);
    expect(result.distribution.map((d) => d.count)).toEqual([1, 1, 0, 1]);
    expect(result.stats).toMatchObject({ memberCount: 3, pagesRead: 570, discussions: 0 });
  });
});

describe('feed', () => {
  it('shows topics and polls from my clubs only, locked by each club page', async () => {
    now = new Date();
    const owner = await reader();
    const first = await club(owner);
    const second = await club(owner);
    const member = await reader();
    await join(member, first.club.id);
    await setPage(member, first.bookId, 100);
    const post = (clubId: string, spoilerPage: number, title: string) =>
      h.call(`/v1/clubs/${clubId}/posts`, {
        method: 'POST',
        cookie: owner.cookie,
        json: { id: crypto.randomUUID(), title, body: 'Texto.', spoilerPage },
      });
    await post(first.club.id, 50, 'Seguro');
    await post(first.club.id, 200, 'Adiante');
    await post(second.club.id, 0, 'Outro clube');
    await h.call(`/v1/clubs/${first.club.id}/polls`, {
      method: 'POST',
      cookie: owner.cookie,
      json: {
        id: crypto.randomUUID(),
        question: 'Qual o melhor capítulo?',
        options: ['Um', 'Dois'],
        durationDays: 7,
        spoilerPage: 0,
      },
    });
    const feed = communityFeedResponseSchema.parse(
      await (await h.call('/v1/community/feed', { cookie: member.cookie })).json(),
    );
    expect(feed.items).toHaveLength(3);
    expect(feed.newLast24h).toBe(3);
    const topics = feed.items.filter((i) => i.type === 'topic');
    expect(topics.map((i) => (i.type === 'topic' ? [i.post.title, i.post.locked] : null))).toEqual(
      expect.arrayContaining([
        ['Seguro', false],
        [null, true],
      ]),
    );
    expect(feed.items.every((i) => i.club.id === first.club.id && i.club.readerPage === 100)).toBe(
      true,
    );
    expect(JSON.stringify(feed)).not.toContain('Outro clube');
    const empty = communityFeedResponseSchema.parse(
      await (await h.call('/v1/community/feed', { cookie: (await reader()).cookie })).json(),
    );
    expect(empty).toEqual({ items: [], newLast24h: 0 });
  });
});

describe('memory breakdowns', () => {
  it('returns the period, per-book totals, day parts in local time and focus', async () => {
    now = new Date('2026-09-26T15:00:00.000Z');
    const { cookie } = await h.signUp();
    const entry = shelfEntrySchema.parse(
      await (
        await h.call('/v1/shelf', { method: 'POST', cookie, json: { title: 'Memória por obra' } })
      ).json(),
    );
    const card = recallCardSchema.parse(
      await (
        await h.call('/v1/recall/cards', {
          method: 'POST',
          cookie,
          json: { shelfEntryId: entry.id, prompt: 'Pergunta', localDate: '2026-09-26' },
        })
      ).json(),
    );
    // 23:30 UTC = 20:30 in UTC−3 (evening), 02:30 in UTC+3 (dawn).
    now = new Date('2026-09-27T23:30:00.000Z');
    expect(
      (
        await h.call(`/v1/recall/cards/${card.id}/review`, {
          method: 'POST',
          cookie,
          json: { id: crypto.randomUUID(), grade: 4, localDate: '2026-09-27' },
        })
      ).status,
    ).toBe(201);
    const read = async (query: string) =>
      memoryStatsResponseSchema.parse(
        await (await h.call(`/v1/me/memory?today=2026-09-27${query}`, { cookie })).json(),
      );
    const month = await read('&days=30&tz=-180');
    expect(month.days).toHaveLength(30);
    expect(month.days[0]?.date).toBe('2026-08-29');
    expect(month.books).toEqual([
      expect.objectContaining({ shelfEntryId: entry.id, total: 1, remembered: 1, cards: 1 }),
    ]);
    expect(month.dayParts.evening).toEqual({ total: 1, remembered: 1 });
    expect(month.cardsTotal).toBe(1);
    expect(month.booksWithCards).toBe(1);
    expect((await read('&tz=180')).dayParts.dawn.total).toBe(1);
    expect((await h.call('/v1/me/memory?today=2026-09-27&days=12', { cookie })).status).toBe(422);
    expect((await h.call('/v1/me/memory?today=2026-09-27&tz=9999', { cookie })).status).toBe(422);

    const detail = shelfEntryDetailSchema.parse(
      await (await h.call(`/v1/shelf/${entry.id}`, { cookie })).json(),
    );
    expect(detail.reviewTotals).toEqual({ total: 1, remembered: 1 });
  });
});
