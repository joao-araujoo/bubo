import { z } from 'zod';

/** GET /v1/me/achievements — everything is recomputed from recorded activity (ADR-018). */
export const achievementSchema = z.object({
  id: z.string(),
  category: z.enum(['reading', 'memory', 'consistency']),
  title: z.string(),
  description: z.string(),
  progress: z.number().int().nonnegative(),
  target: z.number().int().positive(),
  unlocked: z.boolean(),
});
export type Achievement = z.infer<typeof achievementSchema>;

export const cognitiveLevelSchema = z.object({
  level: z.number().int().positive(),
  title: z.string(),
  xpTotal: z.number().int().nonnegative(),
  levelStartXp: z.number().int().nonnegative(),
  nextLevelXp: z.number().int().positive().nullable(),
  nextLevelTitle: z.string().nullable(),
});
export type CognitiveLevelResponse = z.infer<typeof cognitiveLevelSchema>;

export const achievementsResponseSchema = z.object({
  level: cognitiveLevelSchema,
  /** Current streak (as in /me/stats) and the longest one in the lookback window. */
  streakDays: z.number().int().nonnegative(),
  longestStreakDays: z.number().int().nonnegative(),
  unlockedCount: z.number().int().nonnegative(),
  achievements: z.array(achievementSchema),
});
export type AchievementsResponse = z.infer<typeof achievementsResponseSchema>;
