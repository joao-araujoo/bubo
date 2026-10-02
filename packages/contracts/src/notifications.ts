import { z } from 'zod';

/** In-app inbox (Task 09). Stores ids and counts only: no message text, so nothing leaks spoilers. */
export const NOTIFICATION_KINDS = [
  'review_due',
  'topic_reply',
  'friend_request',
  'friend_accepted',
  'cycle_started',
] as const;
export const notificationKindSchema = z.enum(NOTIFICATION_KINDS);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  kind: notificationKindSchema,
  createdAt: z.iso.datetime(),
  read: z.boolean(),
  actor: z.object({ id: z.string(), name: z.string() }).nullable(),
  club: z.object({ id: z.string(), name: z.string() }).nullable(),
  /** The reader's own topic or review (topic_reply); null once it was deleted or removed. */
  post: z.object({ id: z.string(), title: z.string(), isReview: z.boolean() }).nullable(),
  /** Due cards (review_due), replies grouped while unread (topic_reply) or goal pages (cycle). */
  count: z.number().int().nonnegative().nullable(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

/** GET /v1/notifications — newest first, at most 50. */
export const notificationsResponseSchema = z.object({
  items: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
});
export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;

/** POST /v1/notifications/read — some ids, or everything. */
export const markNotificationsReadSchema = z.union([
  z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }),
  z.object({ all: z.literal(true) }),
]);
export type MarkNotificationsRead = z.infer<typeof markNotificationsReadSchema>;
