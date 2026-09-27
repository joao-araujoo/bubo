import { type MeResponse } from '@bubo/contracts';
import { type Genre, type ReadingGoal, type ReadingHabit } from '@bubo/domain';
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

/** The first book as chosen: a catalog pick (id + display data) or a manual entry. */
export type FirstBookDraft = {
  title: string;
  author: string | null;
  totalPages: number | null;
  catalogId?: string;
  coverUrls?: string[];
};

export type OnboardingDraft = {
  readingHabit: ReadingHabit | null;
  goals: ReadingGoal[];
  interests: Genre[];
  firstBook: FirstBookDraft | null;
  /** Server response after a successful save (shown on the "Pronto!" screen). */
  saved: MeResponse | null;
};

type OnboardingContextValue = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

function initialDraft(me: MeResponse | null): OnboardingDraft {
  // Prefill from a previous (partial or completed) profile so answers are never lost.
  return {
    readingHabit: me?.profile.readingHabit ?? null,
    goals: me?.profile.goals ?? [],
    interests: me?.profile.interests ?? [],
    firstBook: null,
    saved: null,
  };
}

/** In-memory onboarding answers shared by the onboarding steps (submitted once at the end). */
export function OnboardingProvider({
  children,
  me,
}: {
  children: ReactNode;
  me: MeResponse | null;
}) {
  const [draft, setDraft] = useState<OnboardingDraft>(() => initialDraft(me));
  const value = useMemo(
    () => ({
      draft,
      update: (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch })),
    }),
    [draft],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used inside <OnboardingProvider>.');
  return context;
}

export function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}
