import { z } from 'zod';

/** Friends (Task 08): mutual consent, requests only between members of a shared club. */
export const socialPreferencesSchema = z.object({
  allowRequests: z.boolean(),
  /** Off by default. Turning it on shares only activity from that moment on. */
  shareActivity: z.boolean(),
});
export type SocialPreferences = z.infer<typeof socialPreferencesSchema>;

export const friendActionSchema = z.object({ action: z.enum(['request', 'accept', 'remove']) });
export type FriendAction = z.infer<typeof friendActionSchema>['action'];

export const friendStatusSchema = z.enum(['incoming', 'outgoing', 'accepted']);
export type FriendStatus = z.infer<typeof friendStatusSchema>;

/** GET /v1/community/friends — own relationships and privacy preferences. */
export const friendsResponseSchema = z.object({
  preferences: socialPreferencesSchema,
  friends: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      status: friendStatusSchema,
    }),
  ),
});
export type FriendsResponse = z.infer<typeof friendsResponseSchema>;

/**
 * GET /v1/community/friends-feed — only accepted friends who opted in to sharing, only catalog
 * books, never reflections. `readingNow` is each friend's most recently updated book in progress
 * (Stitch "Lendo agora").
 */
export const friendsFeedSchema = z.object({
  readingNow: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      bookTitle: z.string(),
      currentPage: z.number().int().nonnegative(),
      totalPages: z.number().int().positive().nullable(),
    }),
  ),
  items: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      name: z.string(),
      bookTitle: z.string(),
      minutes: z.number().int().nonnegative(),
      pages: z.number().int().nonnegative(),
      endPage: z.number().int().nonnegative(),
      endedAt: z.iso.datetime(),
    }),
  ),
});
export type FriendsFeed = z.infer<typeof friendsFeedSchema>;
