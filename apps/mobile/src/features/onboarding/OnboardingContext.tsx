import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

export type ReadingHabit =
  | 'daily'
  | 'few_times_week'
  | 'when_possible'
  | 'returning_reader';

export type OnboardingGoal =
  | 'remember_more'
  | 'understand_better'
  | 'build_habit'
  | 'read_more'
  | 'study_technical_books'
  | 'reflect_on_stories';

type State = {
  readingHabit: ReadingHabit | null;
  goals: OnboardingGoal[];
  interests: string[];
  firstBookId: string | null;
  firstBookSkipped: boolean;
  setReadingHabit: (value: ReadingHabit) => void;
  toggleGoal: (value: OnboardingGoal) => void;
  toggleInterest: (value: string) => void;
  setFirstBook: (value: string | null) => void;
  skipFirstBook: () => void;
};

const Context = createContext<State | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [readingHabit, setReadingHabit] = useState<ReadingHabit | null>(null);
  const [goals, setGoals] = useState<OnboardingGoal[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [firstBookId, setFirstBookId] = useState<string | null>(null);
  const [firstBookSkipped, setFirstBookSkipped] = useState(false);

  const value = useMemo<State>(
    () => ({
      readingHabit,
      goals,
      interests,
      firstBookId,
      firstBookSkipped,
      setReadingHabit,
      toggleGoal: (goal) =>
        setGoals((current) =>
          current.includes(goal)
            ? current.filter((item) => item !== goal)
            : [...current, goal],
        ),
      toggleInterest: (interest) =>
        setInterests((current) =>
          current.includes(interest)
            ? current.filter((item) => item !== interest)
            : [...current, interest],
        ),
      setFirstBook: (id) => {
        setFirstBookSkipped(false);
        setFirstBookId(id);
      },
      skipFirstBook: () => {
        setFirstBookId(null);
        setFirstBookSkipped(true);
      },
    }),
    [firstBookId, firstBookSkipped, goals, interests, readingHabit],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useOnboarding() {
  const context = useContext(Context);
  if (!context) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return context;
}
