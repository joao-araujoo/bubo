import { z } from 'zod';

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const ScoreConfidenceSchema = z.enum(['insufficient', 'low', 'medium', 'high']);
export type ScoreConfidence = z.infer<typeof ScoreConfidenceSchema>;

export const ReadingHabitSchema = z.enum([
  'daily',
  'few_times_week',
  'when_possible',
  'returning_reader',
]);
export type ReadingHabit = z.infer<typeof ReadingHabitSchema>;

export const OnboardingGoalSchema = z.enum([
  'remember_more',
  'understand_better',
  'build_habit',
  'read_more',
  'study_technical_books',
  'reflect_on_stories',
]);
export type OnboardingGoal = z.infer<typeof OnboardingGoalSchema>;

export const InterestKeySchema = z.enum([
  'science_fiction',
  'philosophy',
  'fantasy',
  'psychology',
  'history',
  'business',
  'technology',
  'biography',
  'science',
  'mystery',
  'self_care',
]);
export type InterestKey = z.infer<typeof InterestKeySchema>;

export const SocialPrivacySchema = z.enum(['public', 'private']);
export type SocialPrivacy = z.infer<typeof SocialPrivacySchema>;

export const OnboardingFirstBookSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    author: z.string().trim().min(1).max(120),
  })
  .strict();

export const OnboardingNotificationsSchema = z
  .object({
    pushEnabled: z.boolean(),
    readingReminders: z.boolean(),
    reviewReminders: z.boolean(),
  })
  .strict();

export const CompleteOnboardingRequestSchema = z
  .object({
    readingHabit: ReadingHabitSchema,
    goals: z.array(OnboardingGoalSchema).min(1).max(6),
    interests: z.array(InterestKeySchema).min(1).max(11),
    firstBook: OnboardingFirstBookSchema.nullable(),
    annualBookGoal: z.number().int().min(1).max(365),
    notifications: OnboardingNotificationsSchema,
    socialPrivacy: SocialPrivacySchema,
  })
  .strict();

export type CompleteOnboardingRequest = z.infer<
  typeof CompleteOnboardingRequestSchema
>;

export const MeResponseSchema = z
  .object({
    user: z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
    }),
    profile: z.object({
      displayName: z.string(),
      isPrivate: z.boolean(),
      onboardingCompleted: z.boolean(),
    }),
    settings: z.object({
      theme: z.enum(['system', 'light', 'dark']),
      reduceMotion: z.boolean(),
      hapticsEnabled: z.boolean(),
      soundsEnabled: z.boolean(),
    }),
    notifications: z.object({
      pushEnabled: z.boolean(),
      readingReminders: z.boolean(),
      reviewReminders: z.boolean(),
    }),
  })
  .strict();

export type MeResponse = z.infer<typeof MeResponseSchema>;
