import { CompleteOnboardingRequestSchema } from '@bubo/contracts';
import { describe, expect, it } from 'vitest';

const valid = {
  readingHabit: 'daily',
  goals: ['remember_more'],
  interests: ['philosophy'],
  firstBook: null,
  annualBookGoal: 12,
  notifications: {
    pushEnabled: false,
    readingReminders: true,
    reviewReminders: true,
  },
  socialPrivacy: 'private',
} as const;

describe('CompleteOnboardingRequestSchema', () => {
  it('accepts the complete Slice 1 payload', () => {
    expect(CompleteOnboardingRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects attempts to inject another user id', () => {
    expect(
      CompleteOnboardingRequestSchema.safeParse({
        ...valid,
        user_id: 'another-user',
      }).success,
    ).toBe(false);
  });

  it('requires at least one real goal and interest', () => {
    expect(
      CompleteOnboardingRequestSchema.safeParse({
        ...valid,
        goals: [],
      }).success,
    ).toBe(false);
  });
});
