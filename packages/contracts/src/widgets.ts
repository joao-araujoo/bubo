import { z } from 'zod';

/** Official poses copied into the widget extensions (file names under assets/mascot). */
export const WIDGET_POSES = [
  'welcome',
  'happy',
  'reading',
  'review',
  'celebrating',
  'achievement',
  'cheering',
  'worried',
  'surprised',
  'sleeping',
  'doubt',
] as const;
export const widgetPoseSchema = z.enum(WIDGET_POSES);
export type WidgetPose = z.infer<typeof widgetPoseSchema>;

/** Scene palettes; colours live in the mobile theme (`widgetScenes`). */
export const WIDGET_SCENES = [
  'sky',
  'teal',
  'sunset',
  'alarm',
  'night',
  'gold',
  'mint',
  'candy',
  'periwinkle',
  'slate',
  'lavender',
] as const;
export const widgetSceneSchema = z.enum(WIDGET_SCENES);
export type WidgetScene = z.infer<typeof widgetSceneSchema>;

/** What the widget shows from `fromHour` (local) until the next mood of the same day. */
export const widgetMoodSchema = z.object({
  fromHour: z.number().int().min(0).max(23),
  scene: widgetSceneSchema,
  pose: widgetPoseSchema,
  /** Short caption under the streak number ("Bora ler?"). */
  message: z.string(),
  /** Whether the flame is lit: activity already counted today. */
  lit: z.boolean(),
  /** Red "!" badge on the flame: the streak is at risk tonight. */
  alert: z.boolean(),
});
export type WidgetMood = z.infer<typeof widgetMoodSchema>;

/** Minimal snapshot shared with the system extension; deliberately excludes personal notes. */
export const widgetSnapshotSchema = z.object({
  version: z.literal(2),
  today: z.string(),
  updatedAt: z.number(),
  expiresAt: z.number(),
  hideBookOnLockScreen: z.boolean(),
  /** Consecutive days with a session or a review (as in /me/stats). */
  streakDays: z.number().int().nonnegative(),
  /** A session or a review already happened today. */
  activeToday: z.boolean(),
  weeklyGoal: z.number().int().min(1).max(7),
  /** Days with a reading session this week (the weekly goal counts reading only). */
  activeDays: z.number().int().min(0).max(7),
  /** Monday→Sunday; `active` = streak activity, `read` = reading session. */
  week: z
    .array(
      z.object({
        label: z.string(),
        date: z.string(),
        active: z.boolean(),
        read: z.boolean(),
        state: z.enum(['done', 'missed', 'today', 'future']),
      }),
    )
    .length(7),
  /** Current month calendar, Monday first; runs join consecutive active days in a row. */
  month: z.object({
    label: z.string(),
    /** Empty cells before day 1 (0 = month starts on Monday). */
    offset: z.number().int().min(0).max(6),
    days: z.array(
      z.object({
        day: z.number().int().min(1).max(31),
        active: z.boolean(),
        today: z.boolean(),
        future: z.boolean(),
        run: z.enum(['none', 'single', 'start', 'middle', 'end']),
      }),
    ),
  }),
  /** Today's moods by hour; the native widget picks the last one with fromHour <= now. */
  moods: z.array(widgetMoodSchema).min(1),
  /** Mood for "now" (in-app previews). */
  scene: widgetSceneSchema,
  pose: widgetPoseSchema,
  message: z.string(),
  availableReviews: z.number().int().nonnegative(),
  pendingReviews: z.number().int().nonnegative(),
  nextDueDate: z.string().nullable(),
  book: z
    .object({
      title: z.string(),
      page: z.number().int().nonnegative(),
      totalPages: z.number().int().nullable(),
      progress: z.number().int().min(0).max(100).nullable(),
      coverUrl: z.string().nullable(),
      url: z.string(),
      sessionUrl: z.string(),
    })
    .nullable(),
  url: z.string(),
  reviewUrl: z.string(),
});
export type WidgetSnapshot = z.infer<typeof widgetSnapshotSchema>;
