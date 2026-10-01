import { z } from 'zod';

export const socialPreferencesSchema = z.object({
  allowRequests: z.boolean(),
  shareActivity: z.boolean(),
});
export type SocialPreferences = z.infer<typeof socialPreferencesSchema>;
export const friendActionSchema = z.object({ action: z.enum(['request', 'accept', 'remove']) });
export type FriendAction = z.infer<typeof friendActionSchema>['action'];
export const friendsResponseSchema = z.object({
  preferences: socialPreferencesSchema,
  friends: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      status: z.enum(['incoming', 'outgoing', 'accepted']),
    }),
  ),
});
export const friendsFeedSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      name: z.string(),
      bookTitle: z.string(),
      minutes: z.number().int().nonnegative(),
      pages: z.number().int().nonnegative(),
      endedAt: z.iso.datetime(),
    }),
  ),
});
