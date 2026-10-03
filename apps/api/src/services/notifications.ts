import {
  type MarkNotificationsRead,
  type NotificationKind,
  notificationsResponseSchema,
} from '@bubo/contracts';
import { type Executor, schema } from '@bubo/database';
import { and, eq, inArray, isNull, ne, sql } from 'drizzle-orm';

import { type PushMessage } from './push';
import { reviewReminderCopy } from './notification-copy';

const { clubMembers, clubPosts, clubs, notifications, users } = schema;

const PAGE = 50;

/**
 * What the reader may still see: nothing from a reader blocked in either direction, nothing from
 * a club they left, and friend requests only while still pending.
 */
const visible = (userId: string) => sql`
  n.user_id = ${userId}
  AND (n.actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM user_blocks b
    WHERE (b.blocker_user_id = ${userId} AND b.blocked_user_id = n.actor_user_id)
       OR (b.blocker_user_id = n.actor_user_id AND b.blocked_user_id = ${userId})))
  AND (n.club_id IS NULL OR EXISTS (
    SELECT 1 FROM reading_club_members m WHERE m.club_id = n.club_id AND m.user_id = ${userId}))
  AND (n.kind <> 'friend_request' OR EXISTS (
    SELECT 1 FROM reading_club_friendships f
    WHERE f.sender_id = n.actor_user_id AND f.recipient_id = ${userId} AND f.accepted_at IS NULL))
`;

export async function listNotifications(db: Executor, userId: string) {
  const rows = await db.execute(sql`
    SELECT n.id, n.kind, n.created_at AS "createdAt", n.read_at AS "readAt", n.count,
      a.id AS "actorId", a.name AS "actorName", c.id AS "clubId", c.name AS "clubName",
      p.id AS "postId", p.title AS "postTitle", (p.review_rating IS NOT NULL) AS "isReview"
    FROM reader_notifications n
    LEFT JOIN users a ON a.id = n.actor_user_id
    LEFT JOIN reading_clubs c ON c.id = n.club_id
    LEFT JOIN reading_club_posts p ON n.kind = 'topic_reply' AND p.id = n.target_id
      AND p.author_user_id = n.user_id AND p.status <> 'removed'
    WHERE ${visible(userId)}
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT ${PAGE}
  `);
  const [unread] = (
    await db.execute(sql`
      SELECT count(*)::int AS n FROM reader_notifications n
      WHERE ${visible(userId)} AND n.read_at IS NULL
    `)
  ).rows;
  // Drivers return timestamps as Date or ISO text.
  const iso = (value: unknown) => new Date(String(value)).toISOString();
  return notificationsResponseSchema.parse({
    unreadCount: Number(unread?.n ?? 0),
    items: rows.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      createdAt: iso(row.createdAt),
      read: row.readAt !== null,
      actor: row.actorId ? { id: row.actorId, name: row.actorName } : null,
      club: row.clubId ? { id: row.clubId, name: row.clubName } : null,
      post: row.postId
        ? { id: row.postId, title: row.postTitle, isReview: Boolean(row.isReview) }
        : null,
      count: row.count === null ? null : Number(row.count),
    })),
  });
}

export async function markNotificationsRead(
  db: Executor,
  userId: string,
  input: MarkNotificationsRead,
  now: Date,
) {
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
        ...('ids' in input ? [inArray(notifications.id, input.ids)] : []),
      ),
    );
  return listNotifications(db, userId);
}

async function nameOf(db: Executor, userId: string) {
  const [row] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  return row?.name ?? 'Um leitor';
}

async function clubName(db: Executor, clubId: string) {
  const [row] = await db.select({ name: clubs.name }).from(clubs).where(eq(clubs.id, clubId));
  return row?.name ?? 'seu clube';
}

function insert(
  db: Executor,
  values: {
    userId: string;
    kind: NotificationKind;
    actorUserId?: string | null;
    clubId?: string | null;
    targetId?: string | null;
    count?: number | null;
  },
  now: Date,
) {
  return db.insert(notifications).values({
    id: crypto.randomUUID(),
    actorUserId: null,
    clubId: null,
    targetId: null,
    count: null,
    ...values,
    createdAt: now,
  });
}

/**
 * Someone replied to the reader's topic or review. Unread replies to the same topic are grouped
 * into one item ("Ana e mais 2 responderam"); the reply text never enters the inbox or the push.
 */
export async function notifyTopicReply(
  db: Executor,
  reply: { replierId: string; clubId: string; postId: string },
  now: Date,
): Promise<PushMessage[]> {
  const [post] = await db
    .select({ authorId: clubPosts.authorUserId, rating: clubPosts.reviewRating })
    .from(clubPosts)
    .where(and(eq(clubPosts.id, reply.postId), eq(clubPosts.clubId, reply.clubId)))
    .limit(1);
  if (!post || post.authorId === reply.replierId) return [];
  const input = { ...reply, authorId: post.authorId, isReview: post.rating !== null };
  const [existing] = await db
    .select({ id: notifications.id, count: notifications.count })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, input.authorId),
        eq(notifications.kind, 'topic_reply'),
        eq(notifications.targetId, input.postId),
        isNull(notifications.readAt),
      ),
    )
    .limit(1);
  if (existing) {
    await db
      .update(notifications)
      .set({ count: (existing.count ?? 1) + 1, actorUserId: input.replierId, createdAt: now })
      .where(eq(notifications.id, existing.id));
  } else {
    await insert(
      db,
      {
        userId: input.authorId,
        kind: 'topic_reply',
        actorUserId: input.replierId,
        clubId: input.clubId,
        targetId: input.postId,
        count: 1,
      },
      now,
    );
  }
  const [name, club] = await Promise.all([nameOf(db, input.replierId), clubName(db, input.clubId)]);
  return [
    {
      userId: input.authorId,
      category: 'community',
      title: club,
      body: `${name} respondeu à sua ${input.isReview ? 'resenha' : 'discussão'}.`,
      url: `/${input.isReview ? 'resenhas' : 'debates'}/${input.clubId}/${input.postId}`,
    },
  ];
}

export async function notifyFriendRequest(
  db: Executor,
  input: { senderId: string; recipientId: string },
  now: Date,
): Promise<PushMessage[]> {
  // A new request replaces any older one from the same reader.
  await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.userId, input.recipientId),
        eq(notifications.kind, 'friend_request'),
        eq(notifications.actorUserId, input.senderId),
      ),
    );
  await insert(
    db,
    { userId: input.recipientId, kind: 'friend_request', actorUserId: input.senderId },
    now,
  );
  const name = await nameOf(db, input.senderId);
  return [
    {
      userId: input.recipientId,
      category: 'friends',
      title: 'Pedido de amizade',
      body: `${name} quer ser seu amigo de leitura.`,
      url: '/notificacoes',
    },
  ];
}

export async function notifyFriendAccepted(
  db: Executor,
  input: { senderId: string; recipientId: string },
  now: Date,
): Promise<PushMessage[]> {
  // The request is answered: it leaves the recipient's inbox.
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.userId, input.recipientId),
        eq(notifications.kind, 'friend_request'),
        eq(notifications.actorUserId, input.senderId),
        isNull(notifications.readAt),
      ),
    );
  await insert(
    db,
    { userId: input.senderId, kind: 'friend_accepted', actorUserId: input.recipientId },
    now,
  );
  const name = await nameOf(db, input.recipientId);
  return [
    {
      userId: input.senderId,
      category: 'friends',
      title: 'Amizade aceita',
      body: `Você e ${name} agora são amigos de leitura.`,
      url: '/amigos',
    },
  ];
}

export async function notifyCycleStarted(
  db: Executor,
  input: { ownerId: string; clubId: string; cycleId: string; goalPages: number },
  now: Date,
): Promise<PushMessage[]> {
  const members = await db
    .select({ userId: clubMembers.userId })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, input.clubId), ne(clubMembers.userId, input.ownerId)));
  if (members.length === 0) return [];
  await db.insert(notifications).values(
    members.map((member) => ({
      id: crypto.randomUUID(),
      userId: member.userId,
      kind: 'cycle_started',
      actorUserId: input.ownerId,
      clubId: input.clubId,
      targetId: input.cycleId,
      count: input.goalPages,
      createdAt: now,
    })),
  );
  const club = await clubName(db, input.clubId);
  return members.map((member) => ({
    userId: member.userId,
    category: 'community' as const,
    title: club,
    body: `Novo ciclo de leitura: ${input.goalPages} páginas por pessoa.`,
    url: `/ciclos/${input.clubId}`,
  }));
}

/** Daily review reminder (see reminders.ts): one inbox item per local day. */
export async function notifyReviewsDue(
  db: Executor,
  input: { userId: string; dueCount: number; localDate: string },
  now: Date,
): Promise<PushMessage[]> {
  await insert(db, { userId: input.userId, kind: 'review_due', count: input.dueCount }, now);
  return [
    {
      userId: input.userId,
      category: 'reviews',
      ...reviewReminderCopy(input),
      url: '/revisar',
    },
  ];
}
