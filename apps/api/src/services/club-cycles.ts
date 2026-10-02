import { clubCyclesResponseSchema, type CreateCycleRequest } from '@bubo/contracts';
import { type Database, type Executor, schema } from '@bubo/database';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';
import { bookPages, requireMember } from './community';

const { clubCycles, clubCycleMembers, clubMembers } = schema;

export async function listCycles(db: Executor, userId: string, clubId: string, now: Date) {
  const { club } = await requireMember(db, clubId, userId);
  const result = await db.execute(sql`
    SELECT c.id, c.goal_pages AS "goalPages", c.started_at AS "startedAt", c.ends_at AS "endsAt", c.closed_at AS "closedAt",
      (c.closed_at IS NULL AND c.ends_at > ${now}) AS active,
      count(p.user_id)::int AS "participantCount",
      count(p.user_id) FILTER (WHERE coalesce(p.pages, 0) >= c.goal_pages)::int AS "participantsAtGoal",
      coalesce(sum(p.pages), 0)::int AS "totalPagesRead",
      coalesce(sum(p.pages) FILTER (WHERE p.user_id = ${userId}), 0)::int AS "myPagesRead",
      coalesce(bool_or(p.user_id = ${userId}), false) AS participating
    FROM reading_club_cycles c LEFT JOIN LATERAL (
      SELECT m.user_id, coalesce(sum(s.end_page - s.start_page), 0)::int AS pages
      FROM reading_club_cycle_members m LEFT JOIN reading_sessions s ON s.user_id = m.user_id
        AND s.started_at >= c.started_at AND s.ended_at <= least(c.ends_at, coalesce(c.closed_at, ${now}))
        AND s.shelf_entry_id IN (SELECT id FROM shelf_entries WHERE book_id = ${club.bookId} AND user_id = m.user_id)
      WHERE m.cycle_id = c.id GROUP BY m.user_id
    ) p ON true WHERE c.club_id = ${clubId}
    GROUP BY c.id ORDER BY c.started_at DESC, c.id DESC LIMIT 50
  `);
  // Drivers may return timestamp values as Date or ISO text.
  const cycles = result.rows.map((row) => ({
    ...row,
    startedAt: new Date(String(row.startedAt)).toISOString(),
    endsAt: new Date(String(row.endsAt)).toISOString(),
    closedAt: row.closedAt === null ? null : new Date(String(row.closedAt)).toISOString(),
  }));
  return clubCyclesResponseSchema.parse({ cycles });
}

export async function startCycle(
  db: Database,
  userId: string,
  clubId: string,
  input: CreateCycleRequest,
  now: Date,
) {
  let created = false;
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM reading_clubs WHERE id = ${clubId} FOR UPDATE`);
    const { club, isOwner } = await requireMember(tx, clubId, userId);
    if (!isOwner) throw new AppError('FORBIDDEN', 'Club owner only.');
    const [existing] = await tx
      .select()
      .from(clubCycles)
      .where(eq(clubCycles.id, input.id))
      .limit(1);
    if (existing) {
      if (existing.clubId !== clubId) throw new AppError('CONFLICT', 'Cycle id already used.');
      return;
    }
    const total = await bookPages(tx, club.bookId);
    if (total !== null && input.goalPages > total)
      throw new AppError('VALIDATION_FAILED', 'Goal exceeds the shared book page count.');
    await tx
      .update(clubCycles)
      .set({ closedAt: sql`${clubCycles.endsAt}` })
      .where(
        and(
          eq(clubCycles.clubId, clubId),
          isNull(clubCycles.closedAt),
          lte(clubCycles.endsAt, now),
        ),
      );
    const [active] = await tx
      .select({ id: clubCycles.id })
      .from(clubCycles)
      .where(and(eq(clubCycles.clubId, clubId), isNull(clubCycles.closedAt)))
      .limit(1);
    if (active) throw new AppError('CONFLICT', 'Close the current cycle first.');
    await tx.insert(clubCycles).values({
      id: input.id,
      clubId,
      goalPages: input.goalPages,
      startedAt: now,
      endsAt: new Date(now.getTime() + input.durationDays * 86400000),
    });
    const members = await tx
      .select({ userId: clubMembers.userId })
      .from(clubMembers)
      .where(eq(clubMembers.clubId, clubId));
    if (members.length)
      await tx
        .insert(clubCycleMembers)
        .values(members.map((member) => ({ cycleId: input.id, userId: member.userId })));
    created = true;
  });
  return { cycles: await listCycles(db, userId, clubId, now), created };
}

export async function closeCycle(
  db: Database,
  userId: string,
  clubId: string,
  cycleId: string,
  now: Date,
) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM reading_clubs WHERE id = ${clubId} FOR UPDATE`);
    const { isOwner } = await requireMember(tx, clubId, userId);
    if (!isOwner) throw new AppError('FORBIDDEN', 'Club owner only.');
    const [cycle] = await tx
      .select()
      .from(clubCycles)
      .where(and(eq(clubCycles.id, cycleId), eq(clubCycles.clubId, clubId)))
      .limit(1);
    if (!cycle) throw new AppError('NOT_FOUND', 'Cycle not found.');
    if (!cycle.closedAt)
      await tx
        .update(clubCycles)
        .set({ closedAt: new Date(Math.min(now.getTime(), cycle.endsAt.getTime())) })
        .where(eq(clubCycles.id, cycleId));
  });
  return listCycles(db, userId, clubId, now);
}
