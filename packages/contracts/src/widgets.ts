import { z } from 'zod';

/**
 * Official poses copied into the widget extensions (file names under assets/mascot, e.g.
 * `deep-reading` → bubo-deep-reading.png). Never redrawn, recoloured or cropped (ADR-009).
 */
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
  'curious',
  'confident',
  'thinking',
  'deep-reading',
] as const;
export const widgetPoseSchema = z.enum(WIDGET_POSES);
export type WidgetPose = z.infer<typeof widgetPoseSchema>;

/** Caption tone; the surface is always the same clean background (ADR-029). */
export const WIDGET_TONES = ['calm', 'done', 'risk', 'night', 'stale', 'welcome'] as const;
export const widgetToneSchema = z.enum(WIDGET_TONES);
export type WidgetTone = z.infer<typeof widgetToneSchema>;

/** Home-screen widget kinds (Android receivers / iOS widget kinds). */
export const WIDGET_KINDS = ['streak', 'rhythm', 'calendar', 'reading', 'league'] as const;
export type WidgetKind = (typeof WIDGET_KINDS)[number];

/** What the widget shows from `fromHour` (local) until the next mood of the same day. */
export const widgetMoodSchema = z.object({
  fromHour: z.number().int().min(0).max(23),
  pose: widgetPoseSchema,
  /** Short caption under the streak ("Bora ler um pouquinho?"). */
  message: z.string(),
  /** Whether the flame is lit: activity already counted today. */
  lit: z.boolean(),
  /** Red "!" badge on the flame: the streak is at risk tonight. */
  alert: z.boolean(),
  tone: widgetToneSchema,
});
export type WidgetMood = z.infer<typeof widgetMoodSchema>;

/** Minimal snapshot shared with the system extension; deliberately excludes personal notes. */
export const widgetSnapshotSchema = z.object({
  version: z.literal(3),
  today: z.string(),
  updatedAt: z.number(),
  expiresAt: z.number(),
  hideBookOnLockScreen: z.boolean(),
  /** Consecutive days with a session or a review, protected days included (as in /me/stats). */
  streakDays: z.number().int().nonnegative(),
  /** A session or a review already happened today. */
  activeToday: z.boolean(),
  weeklyGoal: z.number().int().min(1).max(7),
  /** Days with a reading session this week (the weekly goal counts reading only). */
  activeDays: z.number().int().min(0).max(7),
  /** Streak protection (ADR-029): ready protections and whether one covered yesterday. */
  freeze: z.object({
    available: z.number().int().nonnegative(),
    max: z.number().int().positive(),
    frozenYesterday: z.boolean(),
  }),
  /** Monday→Sunday; `active` = streak activity, `read` = reading, `frozen` = protected day. */
  week: z
    .array(
      z.object({
        label: z.string(),
        letter: z.string(),
        date: z.string(),
        active: z.boolean(),
        read: z.boolean(),
        frozen: z.boolean(),
        state: z.enum(['done', 'missed', 'frozen', 'today', 'future']),
      }),
    )
    .length(7),
  /** Current month calendar, Monday first; runs join consecutive active days in a row. */
  month: z.object({
    label: z.string(),
    year: z.number().int(),
    /** "Outubro 2026". */
    title: z.string(),
    /** Empty cells before day 1 (0 = month starts on Monday). */
    offset: z.number().int().min(0).max(6),
    days: z.array(
      z.object({
        day: z.number().int().min(1).max(31),
        active: z.boolean(),
        frozen: z.boolean(),
        today: z.boolean(),
        future: z.boolean(),
        run: z.enum(['none', 'single', 'start', 'middle', 'end']),
      }),
    ),
  }),
  /** Today's moods by hour; the native widget picks the last one with fromHour <= now. */
  moods: z.array(widgetMoodSchema).min(1),
  /** Mood for "now" (in-app previews). */
  pose: widgetPoseSchema,
  message: z.string(),
  tone: widgetToneSchema,
  availableReviews: z.number().int().nonnegative(),
  pendingReviews: z.number().int().nonnegative(),
  nextDueDate: z.string().nullable(),
  book: z
    .object({
      title: z.string(),
      author: z.string().nullable(),
      page: z.number().int().nonnegative(),
      totalPages: z.number().int().nullable(),
      progress: z.number().int().min(0).max(100).nullable(),
      coverUrl: z.string().nullable(),
      /** Index of the typographic fallback cover palette (same pick as BookCover). */
      coverPalette: z.number().int().nonnegative(),
      url: z.string(),
      sessionUrl: z.string(),
    })
    .nullable(),
  /** Weekly friends league (ADR-029); null when it could not be loaded for today. */
  league: z
    .object({
      rank: z.number().int().positive(),
      previousRank: z.number().int().positive().nullable(),
      participants: z.number().int().positive(),
      weeklyXp: z.number().int().nonnegative(),
      daysLeft: z.number().int().min(1).max(7),
      /** Up to three spots, left → right from the lower to the higher rank. */
      podium: z
        .array(
          z.object({
            rank: z.number().int().positive(),
            initials: z.string(),
            xp: z.number().int().nonnegative(),
            me: z.boolean(),
          }),
        )
        .max(3),
    })
    .nullable(),
  url: z.string(),
  reviewUrl: z.string(),
  leagueUrl: z.string(),
});
export type WidgetSnapshot = z.infer<typeof widgetSnapshotSchema>;
