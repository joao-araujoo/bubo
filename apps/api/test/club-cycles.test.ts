import { clubCyclesResponseSchema, clubDetailSchema, meResponseSchema } from '@bubo/contracts';
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

it('scopes cycles, freezes participants, derives only in-window book sessions and closes idempotently', async () => {
  const owner = await h.signUp();
  const member = await h.signUp();
  const late = await h.signUp();
  const who = async (cookie: string) =>
    meResponseSchema.parse(await (await h.call('/v1/me', { cookie })).json()).user.id;
  const ownerId = await who(owner.cookie);
  await h.database.pg.query(
    `INSERT INTO books (id, title, total_pages, catalog_key) VALUES ('cycle-book', 'Livro do ciclo', 300, 'ol:cycle')`,
  );
  await h.database.pg.query(
    `INSERT INTO shelf_entries (id, user_id, book_id) VALUES ('cycle-entry', $1, 'cycle-book')`,
    [ownerId],
  );
  const club = clubDetailSchema.parse(
    await (
      await h.call('/v1/clubs', {
        method: 'POST',
        cookie: owner.cookie,
        json: {
          name: 'Ciclo privado',
          icon: 'mind',
          shelfEntryId: 'cycle-entry',
          visibility: 'private',
        },
      })
    ).json(),
  );
  const join = (cookie: string) =>
    h.call('/v1/clubs/join', {
      method: 'POST',
      cookie,
      json: { code: club.inviteCode, acceptGuidelines: true },
    });
  await join(member.cookie);
  const path = `/v1/clubs/${club.id}/cycles`;
  const input = { id: crypto.randomUUID(), goalPages: 10, durationDays: 7 };
  expect((await h.call(path)).status).toBe(401);
  expect((await h.call(path, { cookie: late.cookie })).status).toBe(404);
  expect((await h.call(path, { method: 'POST', cookie: member.cookie, json: input })).status).toBe(
    403,
  );
  expect(
    (
      await h.call(path, {
        method: 'POST',
        cookie: owner.cookie,
        json: { ...input, goalPages: 301 },
      })
    ).status,
  ).toBe(422);
  const created = await h.call(path, { method: 'POST', cookie: owner.cookie, json: input });
  expect(created.status).toBe(200);
  const cycle = clubCyclesResponseSchema.parse(await created.json()).cycles[0];
  expect(cycle).toMatchObject({ id: input.id, participantCount: 2, myPagesRead: 0, active: true });
  expect((await h.call(path, { method: 'POST', cookie: owner.cookie, json: input })).status).toBe(
    200,
  );
  expect(
    (
      await h.call(path, {
        method: 'POST',
        cookie: owner.cookie,
        json: { ...input, id: crypto.randomUUID() },
      })
    ).status,
  ).toBe(409);
  await join(late.cookie);
  const later = clubCyclesResponseSchema.parse(
    await (await h.call(path, { cookie: late.cookie })).json(),
  );
  expect(later.cycles[0]).toMatchObject({ participating: false, participantCount: 2 });
  now = new Date('2026-09-30T11:00:00Z');
  const session = {
    id: crypto.randomUUID(),
    shelfEntryId: 'cycle-entry',
    startedAt: '2026-09-30T10:10:00Z',
    endedAt: '2026-09-30T10:30:00Z',
    focusedSeconds: 1200,
    endPage: 12,
    reflection: null,
    localDate: '2026-09-30',
  };
  expect(
    (await h.call('/v1/sessions', { method: 'POST', cookie: owner.cookie, json: session })).status,
  ).toBe(201);
  await h.call('/v1/sessions', { method: 'POST', cookie: owner.cookie, json: session });
  const read = async () =>
    clubCyclesResponseSchema.parse(await (await h.call(path, { cookie: owner.cookie })).json());
  expect((await read()).cycles[0]).toMatchObject({
    totalPagesRead: 12,
    myPagesRead: 12,
    participantsAtGoal: 1,
  });
  expect(
    (await h.call(`${path}/${input.id}/close`, { method: 'POST', cookie: member.cookie })).status,
  ).toBe(403);
  expect(
    (await h.call(`${path}/unknown/close`, { method: 'POST', cookie: owner.cookie })).status,
  ).toBe(404);
  expect(
    (await h.call(`${path}/${input.id}/close`, { method: 'POST', cookie: owner.cookie })).status,
  ).toBe(200);
  now = new Date('2026-09-30T12:00:00Z');
  await h.call('/v1/sessions', {
    method: 'POST',
    cookie: owner.cookie,
    json: {
      ...session,
      id: crypto.randomUUID(),
      startedAt: '2026-09-30T11:10:00Z',
      endedAt: '2026-09-30T11:30:00Z',
      endPage: 25,
    },
  });
  await h.call(`${path}/${input.id}/close`, { method: 'POST', cookie: owner.cookie });
  expect((await read()).cycles[0]).toMatchObject({
    active: false,
    totalPagesRead: 12,
    closedAt: '2026-09-30T11:00:00.000Z',
  });
  const next = { ...input, id: crypto.randomUUID() };
  expect((await h.call(path, { method: 'POST', cookie: owner.cookie, json: next })).status).toBe(
    200,
  );
  now = new Date('2026-10-10T12:00:00Z');
  expect((await read()).cycles.every((item) => !item.active)).toBe(true);
  expect(
    (
      await h.call(path, {
        method: 'POST',
        cookie: owner.cookie,
        json: { ...input, id: crypto.randomUUID() },
      })
    ).status,
  ).toBe(200);
});
