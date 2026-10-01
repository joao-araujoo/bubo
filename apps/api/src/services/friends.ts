import {
  type FriendAction,
  type SocialPreferences,
  friendsFeedSchema,
  friendsResponseSchema,
} from '@bubo/contracts';
import { type Database, type Executor, schema } from '@bubo/database';
import { friendPairId } from '@bubo/domain';
import { and, eq, or, sql } from 'drizzle-orm';
import { AppError } from '../lib/errors';

const { friendships, socialPreferences } = schema;

export async function listFriends(db: Executor, userId: string) {
  const [prefs] = await db
    .select()
    .from(socialPreferences)
    .where(eq(socialPreferences.userId, userId))
    .limit(1);
  const result = await db.execute(sql`
    SELECT u.id AS "userId", u.name, CASE WHEN f.accepted_at IS NOT NULL THEN 'accepted'
      WHEN f.recipient_id = ${userId} THEN 'incoming' ELSE 'outgoing' END AS status
    FROM reading_club_friendships f JOIN users u ON u.id = CASE WHEN f.sender_id = ${userId} THEN f.recipient_id ELSE f.sender_id END
    WHERE (f.sender_id = ${userId} OR f.recipient_id = ${userId})
      AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_user_id = ${userId} AND b.blocked_user_id = u.id) OR (b.blocker_user_id = u.id AND b.blocked_user_id = ${userId}))
    ORDER BY f.created_at DESC, f.id LIMIT 200
  `);
  return friendsResponseSchema.parse({
    preferences: {
      allowRequests: prefs?.allowRequests ?? true,
      shareActivity: prefs?.shareActivity ?? false,
    },
    friends: result.rows,
  });
}

export async function changeFriend(
  db: Database,
  userId: string,
  otherId: string,
  action: FriendAction,
  now: Date,
) {
  if (userId === otherId) throw new AppError('VALIDATION_FAILED', 'Choose another reader.');
  await db.transaction(async (tx) => {
    // Same ordered row locks as blockUser: block/request races cannot recreate a friendship.
    await tx.execute(
      sql`SELECT id FROM users WHERE id IN (${userId}, ${otherId}) ORDER BY id FOR UPDATE`,
    );
    const id = friendPairId(userId, otherId);
    if (action === 'remove') {
      await tx.delete(friendships).where(eq(friendships.id, id));
      return;
    }
    const blocked = await tx.execute(
      sql`SELECT 1 FROM user_blocks WHERE (blocker_user_id = ${userId} AND blocked_user_id = ${otherId}) OR (blocker_user_id = ${otherId} AND blocked_user_id = ${userId}) LIMIT 1`,
    );
    if (blocked.rows.length) throw new AppError('NOT_FOUND', 'Reader unavailable.');
    const [existing] = await tx.select().from(friendships).where(eq(friendships.id, id)).limit(1);
    if (action === 'accept') {
      if (!existing || existing.recipientId !== userId)
        throw new AppError('NOT_FOUND', 'Incoming request not found.');
      if (!existing.acceptedAt)
        await tx.update(friendships).set({ acceptedAt: now }).where(eq(friendships.id, id));
      return;
    }
    if (existing) return;
    const [pref] = await tx
      .select()
      .from(socialPreferences)
      .where(eq(socialPreferences.userId, otherId))
      .limit(1);
    const common = await tx.execute(
      sql`SELECT 1 FROM reading_club_members a JOIN reading_club_members b ON a.club_id = b.club_id WHERE a.user_id = ${userId} AND b.user_id = ${otherId} LIMIT 1`,
    );
    if (pref?.allowRequests === false || common.rows.length === 0)
      throw new AppError('NOT_FOUND', 'Reader unavailable for requests.');
    const [count] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(friendships)
      .where(or(eq(friendships.senderId, userId), eq(friendships.recipientId, userId)));
    if ((count?.n ?? 0) >= 200) throw new AppError('CONFLICT', 'Friend limit reached.');
    const [otherCount] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(friendships)
      .where(or(eq(friendships.senderId, otherId), eq(friendships.recipientId, otherId)));
    if ((otherCount?.n ?? 0) >= 200)
      throw new AppError('CONFLICT', 'Reader unavailable for requests.');
    await tx
      .insert(friendships)
      .values({ id, senderId: userId, recipientId: otherId, createdAt: now });
  });
  return listFriends(db, userId);
}

export async function saveSocialPreferences(
  db: Database,
  userId: string,
  input: SocialPreferences,
  now: Date,
) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
    const [existing] = await tx
      .select()
      .from(socialPreferences)
      .where(eq(socialPreferences.userId, userId))
      .limit(1);
    const sharingSince = input.shareActivity
      ? existing?.shareActivity
        ? existing.sharingSince
        : now
      : null;
    await tx
      .insert(socialPreferences)
      .values({ userId, ...input, sharingSince })
      .onConflictDoUpdate({ target: socialPreferences.userId, set: { ...input, sharingSince } });
    if (!input.allowRequests)
      await tx
        .delete(friendships)
        .where(and(eq(friendships.recipientId, userId), sql`${friendships.acceptedAt} IS NULL`));
  });
  return listFriends(db, userId);
}

export async function friendsFeed(db: Executor, userId: string) {
  const result = await db.execute(sql`
    SELECT s.id, u.id AS "userId", u.name, b.title AS "bookTitle",
      floor(s.focused_seconds / 60.0)::int AS minutes, (s.end_page - s.start_page)::int AS pages,
      s.ended_at AS "endedAt"
    FROM reading_club_friendships f
    JOIN users u ON u.id = CASE WHEN f.sender_id = ${userId} THEN f.recipient_id ELSE f.sender_id END
    JOIN reading_club_social_preferences p ON p.user_id = u.id AND p.share_activity = true
    JOIN reading_sessions s ON s.user_id = u.id AND s.started_at >= greatest(f.accepted_at, p.sharing_since)
    JOIN shelf_entries e ON e.id = s.shelf_entry_id AND e.user_id = u.id
    JOIN books b ON b.id = e.book_id AND b.catalog_key IS NOT NULL
    WHERE (f.sender_id = ${userId} OR f.recipient_id = ${userId}) AND f.accepted_at IS NOT NULL AND p.sharing_since IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM user_blocks x WHERE (x.blocker_user_id = ${userId} AND x.blocked_user_id = u.id) OR (x.blocker_user_id = u.id AND x.blocked_user_id = ${userId}))
    ORDER BY s.ended_at DESC, s.id DESC LIMIT 50
  `);
  return friendsFeedSchema.parse({
    items: result.rows.map((row) => ({
      ...row,
      endedAt: new Date(String(row.endedAt)).toISOString(),
    })),
  });
}
