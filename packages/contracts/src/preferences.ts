import {
  ANNUAL_BOOK_GOAL_MAX,
  DAILY_FOCUS_OPTIONS,
  DAILY_REVIEW_LIMIT_MAX,
  DAILY_REVIEW_LIMIT_MIN,
  REVIEW_INTENSITIES,
  isValidTimeZone,
} from '@bubo/domain';
import { z } from 'zod';

/**
 * GET|PUT /v1/me/preferences — the reader's cognitive and notification preferences (Task 09).
 * Device-only choices (theme, haptics) stay on the device.
 */
export const readerPreferencesSchema = z.object({
  reviewIntensity: z.enum(REVIEW_INTENSITIES),
  dailyReviewLimit: z.number().int().min(DAILY_REVIEW_LIMIT_MIN).max(DAILY_REVIEW_LIMIT_MAX),
  dailyFocusMinutes: z.literal(DAILY_FOCUS_OPTIONS),
  /** Books to finish this calendar year; null = no goal. */
  annualBookGoal: z.number().int().min(1).max(ANNUAL_BOOK_GOAL_MAX).nullable(),
  /** Daily push when cards are due, at `reminderHour` in `timeZone`. Off by default. */
  reviewReminder: z.boolean(),
  reminderHour: z.number().int().min(0).max(23),
  timeZone: z.string().refine(isValidTimeZone, 'Unknown time zone.'),
  /** Push for replies to my topics and cycles in my clubs (the inbox always records them). */
  notifyCommunity: z.boolean(),
  /** Push for friend requests and accepted friendships. */
  notifyFriends: z.boolean(),
});
export type ReaderPreferences = z.infer<typeof readerPreferencesSchema>;

/** POST /v1/me/push-token — an Expo push token for this device (moves between accounts). */
export const pushTokenRequestSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(
      /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/,
      'Not an Expo push token.',
    ),
  platform: z.enum(['ios', 'android']),
  /** Reject an asynchronous registration if the device has switched accounts mid-request. */
  expectedUserId: z.string().min(1).max(255).optional(),
});
export type PushTokenRequest = z.infer<typeof pushTokenRequestSchema>;
export const pushTokenResponseSchema = z.object({ registered: z.boolean() });
