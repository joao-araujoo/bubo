import { useMemo } from 'react';

import { Screen } from '../../design-system';
import { HomeHeader } from '../../features/home/HomeHeader';
import { ReadingNowSection } from '../../features/home/ReadingNowSection';
import { RecoveryCard } from '../../features/session/RecoveryCard';
import {
  ActiveRecallSection,
  CognitiveWeekSection,
  DailyMissionSection,
  HowBuboWorksSection,
} from '../../features/home/sections';
import { useDueCards, usePreferences, useShelf, useStats } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { FadeIn } from '../../lib/motion';

/** Hoje — the north-star screen. Every number here comes from real sessions. */
export default function TodayScreen() {
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const stats = useStats(userId);
  const shelf = useShelf(userId);
  const due = useDueCards(userId);
  const preferences = usePreferences(userId);
  const weekDates = stats.data?.weekActiveDates;
  const activeDates = useMemo(() => new Set<string>(weekDates ?? []), [weekDates]);
  if (auth.status !== 'ready') return null;

  const reading = shelf.data?.entries.find((entry) => entry.status === 'reading') ?? null;
  const sections = [
    <RecoveryCard key={`recovery-${auth.userId}`} userId={auth.userId} />,
    <ReadingNowSection key="reading" userId={auth.userId} />,
    <ActiveRecallSection
      key="recall"
      dueCount={due.data?.cards.length ?? null}
      totalCards={due.data?.totalCards ?? null}
    />,
    <CognitiveWeekSection
      key="week"
      activeDates={activeDates}
      focusedMinutes={stats.data?.focusedMinutesThisWeek ?? null}
    />,
    <DailyMissionSection
      key="mission"
      readToday={stats.data?.readToday ?? null}
      readingEntryId={reading?.id ?? null}
      focusedMinutesToday={stats.data?.focusedMinutesToday ?? null}
      goalMinutes={preferences.data?.dailyFocusMinutes ?? null}
    />,
    <HowBuboWorksSection key="how" />,
  ];
  return (
    <Screen
      header={
        <HomeHeader
          name={auth.me.user.name}
          userId={auth.userId}
          streakDays={stats.data?.streakDays ?? null}
          xp={stats.data?.xpTotal ?? null}
        />
      }
    >
      {sections.map((section, index) => (
        <FadeIn key={section.key} index={index}>
          {section}
        </FadeIn>
      ))}
    </Screen>
  );
}
