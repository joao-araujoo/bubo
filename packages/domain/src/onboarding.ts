/**
 * Onboarding vocabulary (ids are stable API/DB values; UI labels live in the app).
 * Order follows the Stitch onboarding screens.
 */
export const READING_HABITS = ['daily', 'weekly', 'free_time', 'restarting'] as const;
export type ReadingHabit = (typeof READING_HABITS)[number];

export const READING_GOALS = [
  'remember_more',
  'understand_better',
  'build_habit',
  'read_more',
  'technical_study',
  'reflect_stories',
] as const;
export type ReadingGoal = (typeof READING_GOALS)[number];

export const GENRES = [
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
] as const;
export type Genre = (typeof GENRES)[number];

/** Onboarding step order (1..6), shared by the app's progress indicator. */
export const ONBOARDING_STEPS = [
  'welcome',
  'habit',
  'goals',
  'interests',
  'first_book',
  'done',
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const MAX_BOOK_PAGES = 20_000;

/** Removes duplicates while keeping the reader's selection order. */
export function uniqueSelection<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
