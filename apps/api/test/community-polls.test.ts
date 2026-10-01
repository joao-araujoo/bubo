import {
  clubDetailSchema,
  clubPollDetailSchema,
  clubPollSchema,
  clubPollsResponseSchema,
  clubPostSchema,
  clubPostsResponseSchema,
  meResponseSchema,
  reactionResponseSchema,
  shelfResponseSchema,
} from '@bubo/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness } from './harness';

// Server time is controllable so polls can be closed without waiting.
let now = new Date();
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

async function club(owner: Reader, extra: Record<string, unknown> = {}) {
  counter += 1;
  await h.database.pg.query(
    `INSERT INTO "books" ("id", "title", "total_pages", "catalog_key") VALUES ($1, 'Duna', 400, $2)`,
    [`poll-book-${counter}`, `ol:poll${counter}`],
  );
  await h.database.pg.query(
    `INSERT INTO "shelf_entries" ("id", "user_id", "book_id") VALUES ($1, $2, $3)`,
    [`poll-entry-${counter}`, owner.id, `poll-book-${counter}`],
  );
  const response = await h.call('/v1/clubs', {
    method: 'POST',
    cookie: owner.cookie,
    json: {
      name: `Clube ${counter}`,
      icon: 'mind',
      shelfEntryId: `poll-entry-${counter}`,
      ...extra,
    },
  });
  expect(response.status).toBe(201);
  return { club: clubDetailSchema.parse(await response.json()), bookId: `poll-book-${counter}` };
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
  await h.call(`/v1/shelf/${entry.id}`, {
    method: 'PATCH',
    cookie: who.cookie,
    json: { currentPage: page },
  });
}

const createPoll = (who: Reader, clubId: string, json: Record<string, unknown> = {}) =>
  h.call(`/v1/clubs/${clubId}/polls`, {
    method: 'POST',
    cookie: who.cookie,
    json: {
      id: crypto.randomUUID(),
      question: 'A presciência é uma prisão?',
      options: ['Uma prisão fatalista', 'Um dom libertador'],
      durationDays: 3,
      spoilerPage: 0,
      ...json,
    },
  });

const vote = (who: Reader, clubId: string, pollId: string, optionIds: string[]) =>
  h.call(`/v1/clubs/${clubId}/polls/${pollId}/vote`, {
    method: 'PUT',
    cookie: who.cookie,
    json: { optionIds },
  });

describe('polls', () => {
  it('validates, is idempotent and hides results until the reader votes', async () => {
    now = new Date('2026-09-27T12:00:00.000Z');
    const owner = await reader();
    const { club: c } = await club(owner);
    const member = await reader();
    await join(member, c.id);

    for (const json of [
      { options: ['Só uma'] },
      { options: ['A', 'B', 'C', 'D', 'E'] },
      { options: ['Igual', 'igual'] },
      { durationDays: 5 },
      { question: 'Oi?' },
      { spoilerPage: 401 },
    ]) {
      expect((await createPoll(owner, c.id, json)).status).toBe(422);
    }
    const id = crypto.randomUUID();
    const created = await createPoll(owner, c.id, { id });
    expect(created.status).toBe(201);
    const poll = clubPollSchema.parse(await created.json());
    expect(poll).toMatchObject({
      isOpen: true,
      isMine: true,
      resultsVisible: true,
      closesAt: '2026-09-30T12:00:00.000Z',
    });
    expect((await createPoll(owner, c.id, { id })).status).toBe(200);
    expect((await createPoll(member, c.id, { id })).status).toBe(409);

    const before = clubPollsResponseSchema.parse(
      await (await h.call(`/v1/clubs/${c.id}/polls`, { cookie: member.cookie })).json(),
    );
    expect(before.polls[0]).toMatchObject({ resultsVisible: false, totalVotes: 0 });
    expect(before.polls[0]?.options.every((o) => o.percent === null && o.votes === null)).toBe(
      true,
    );

    const [first, second] = poll.options;
    if (!first || !second) throw new Error('options missing');
    expect((await vote(member, c.id, poll.id, [first.id, second.id])).status).toBe(422);
    expect((await vote(member, c.id, poll.id, ['nope'])).status).toBe(422);
    const voted = clubPollSchema.parse(
      await (await vote(member, c.id, poll.id, [first.id])).json(),
    );
    expect(voted.resultsVisible).toBe(true);
    expect(voted.options.map((o) => [o.percent, o.mine])).toEqual([
      [100, true],
      [0, false],
    ]);
    // Changing the vote replaces it (never counts twice).
    const changed = clubPollSchema.parse(
      await (await vote(member, c.id, poll.id, [second.id])).json(),
    );
    expect(changed.options.map((o) => o.votes)).toEqual([0, 1]);
    expect(changed.voterCount).toBe(1);

    now = new Date('2026-09-30T12:00:01.000Z');
    expect((await vote(member, c.id, poll.id, [first.id])).status).toBe(409);
    const closed = clubPollsResponseSchema.parse(
      await (await h.call(`/v1/clubs/${c.id}/polls`, { cookie: owner.cookie })).json(),
    );
    expect(closed.polls[0]?.isOpen).toBe(false);
  });

  it('supports multiple choice and requires a vote before an argument', async () => {
    now = new Date();
    const owner = await reader();
    const { club: c } = await club(owner);
    const member = await reader();
    await join(member, c.id);
    const poll = clubPollSchema.parse(
      await (await createPoll(owner, c.id, { options: ['A', 'B', 'C'], multiple: true })).json(),
    );
    const argue = (body: string) =>
      h.call(`/v1/clubs/${c.id}/polls/${poll.id}/argument`, {
        method: 'PUT',
        cookie: member.cookie,
        json: { body },
      });
    expect((await argue('Antes de votar.')).status).toBe(422);
    const ids = poll.options.map((o) => o.id);
    const voted = clubPollSchema.parse(
      await (await vote(member, c.id, poll.id, [ids[0] ?? '', ids[2] ?? ''])).json(),
    );
    expect(voted.options.map((o) => o.mine)).toEqual([true, false, true]);
    expect((await argue('Porque a profecia prende.')).status).toBe(200);
    expect((await argue('Edição do argumento.')).status).toBe(200);
    const detail = clubPollDetailSchema.parse(
      await (await h.call(`/v1/clubs/${c.id}/polls/${poll.id}`, { cookie: owner.cookie })).json(),
    );
    expect(detail.arguments).toHaveLength(1);
    expect(detail.arguments[0]).toMatchObject({
      body: 'Edição do argumento.',
      votedFor: ['A', 'C'],
      isMine: false,
    });
    expect(detail.poll.argumentCount).toBe(1);

    // Owner reacts to the argument; the author cannot react to their own.
    const react = (who: Reader, active: boolean) =>
      h.call('/v1/reactions', {
        method: 'PUT',
        cookie: who.cookie,
        json: {
          targetType: 'argument',
          targetId: detail.arguments[0]?.id,
          kind: 'insight',
          active,
        },
      });
    expect((await react(member, true)).status).toBe(422);
    const on = reactionResponseSchema.parse(await (await react(owner, true)).json());
    expect(on).toEqual({
      reactions: { insight: 1, idea: 0, counterpoint: 0 },
      myReactions: ['insight'],
    });
    expect(
      reactionResponseSchema.parse(await (await react(owner, true)).json()).reactions.insight,
    ).toBe(1);
    const off = reactionResponseSchema.parse(await (await react(owner, false)).json());
    expect(off.reactions.insight).toBe(0);

    expect(
      (
        await h.call(`/v1/clubs/${c.id}/polls/${poll.id}/argument`, {
          method: 'DELETE',
          cookie: member.cookie,
        })
      ).status,
    ).toBe(200);
    const after = clubPollDetailSchema.parse(
      await (await h.call(`/v1/clubs/${c.id}/polls/${poll.id}`, { cookie: owner.cookie })).json(),
    );
    expect(after.arguments).toEqual([]);
  });

  it('locks a poll and its arguments beyond the reader page', async () => {
    now = new Date();
    const owner = await reader();
    const { club: c, bookId } = await club(owner);
    const member = await reader();
    await join(member, c.id);
    const poll = clubPollSchema.parse(
      await (await createPoll(owner, c.id, { spoilerPage: 300 })).json(),
    );
    const listed = clubPollsResponseSchema.parse(
      await (await h.call(`/v1/clubs/${c.id}/polls`, { cookie: member.cookie })).json(),
    );
    expect(listed.polls[0]).toMatchObject({ locked: true, question: null });
    expect(listed.polls[0]?.options.every((o) => o.label === null)).toBe(true);
    expect(JSON.stringify(listed)).not.toContain('presciência');
    const peek = clubPollDetailSchema.parse(
      await (
        await h.call(`/v1/clubs/${c.id}/polls/${poll.id}?reveal=1`, { cookie: member.cookie })
      ).json(),
    );
    expect(peek.poll.question).toBe('A presciência é uma prisão?');
    await setPage(member, bookId, 300);
    const unlocked = clubPollsResponseSchema.parse(
      await (await h.call(`/v1/clubs/${c.id}/polls`, { cookie: member.cookie })).json(),
    );
    expect(unlocked.polls[0]?.locked).toBe(false);
  });

  it('reports, moderates and deletes polls', async () => {
    now = new Date();
    const owner = await reader();
    const { club: c } = await club(owner);
    const author = await reader();
    const other = await reader();
    await join(author, c.id);
    await join(other, c.id);
    const poll = clubPollSchema.parse(await (await createPoll(author, c.id)).json());
    const report = await h.call('/v1/reports', {
      method: 'POST',
      cookie: other.cookie,
      json: { targetType: 'poll', targetId: poll.id, reason: 'spam' },
    });
    expect(report.status).toBe(200);
    const ownerView = clubPollsResponseSchema.parse(
      await (await h.call(`/v1/clubs/${c.id}/polls`, { cookie: owner.cookie })).json(),
    );
    expect(ownerView.polls[0]?.openReportCount).toBe(1);
    expect(
      clubDetailSchema.parse(
        await (await h.call(`/v1/clubs/${c.id}`, { cookie: owner.cookie })).json(),
      ).openReports,
    ).toBe(1);
    const remove = await h.call(`/v1/clubs/${c.id}/moderation`, {
      method: 'POST',
      cookie: owner.cookie,
      json: { targetType: 'poll', targetId: poll.id, action: 'remove' },
    });
    expect(remove.status).toBe(200);
    expect(
      clubPollsResponseSchema.parse(
        await (await h.call(`/v1/clubs/${c.id}/polls`, { cookie: author.cookie })).json(),
      ).polls,
    ).toEqual([]);
    const own = clubPollSchema.parse(await (await createPoll(author, c.id)).json());
    expect(
      (
        await h.call(`/v1/clubs/${c.id}/polls/${own.id}`, {
          method: 'DELETE',
          cookie: other.cookie,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await h.call(`/v1/clubs/${c.id}/polls/${own.id}`, {
          method: 'DELETE',
          cookie: author.cookie,
        })
      ).status,
    ).toBe(200);
    const { rows } = await h.database.pg.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM "reading_club_poll_options" WHERE "poll_id" = $1`,
      [own.id],
    );
    expect(rows[0]?.n).toBe(0);
  });
});

describe('topics with type, chapter, quote and reactions', () => {
  it('stores the new fields, locks the quote and counts reactions per kind', async () => {
    now = new Date();
    const owner = await reader();
    const { club: c } = await club(owner);
    const member = await reader();
    await join(member, c.id);
    const created = await h.call(`/v1/clubs/${c.id}/posts`, {
      method: 'POST',
      cookie: owner.cookie,
      json: {
        id: crypto.randomUUID(),
        title: 'A litania',
        body: 'Sobre o medo.',
        spoilerPage: 50,
        kind: 'philosophical',
        chapter: 3,
        quote: 'Não terei medo.',
      },
    });
    expect(created.status).toBe(201);
    const topic = clubPostSchema.parse(await created.json());
    expect(topic).toMatchObject({ kind: 'philosophical', chapter: 3, quote: 'Não terei medo.' });
    expect(topic.author.level).toBe(1);
    const locked = clubPostsResponseSchema.parse(
      await (await h.call(`/v1/clubs/${c.id}/posts`, { cookie: member.cookie })).json(),
    );
    expect(locked.posts[0]).toMatchObject({ locked: true, quote: null, chapter: 3 });

    const react = (kind: string, active = true) =>
      h.call('/v1/reactions', {
        method: 'PUT',
        cookie: member.cookie,
        json: { targetType: 'post', targetId: topic.id, kind, active },
      });
    await react('insight');
    await react('idea');
    const listed = clubPostsResponseSchema.parse(
      await (await h.call(`/v1/clubs/${c.id}/posts`, { cookie: member.cookie })).json(),
    );
    expect(listed.posts[0]).toMatchObject({
      reactions: { insight: 1, idea: 1, counterpoint: 0 },
      myReactions: ['idea', 'insight'],
    });
    const outsider = await reader();
    expect(
      (
        await h.call('/v1/reactions', {
          method: 'PUT',
          cookie: outsider.cookie,
          json: { targetType: 'post', targetId: topic.id, kind: 'idea', active: true },
        })
      ).status,
    ).toBe(403);
    expect((await react('love')).status).toBe(422);
  });
});
