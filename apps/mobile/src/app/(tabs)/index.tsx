import { selectTodayAction, toLocalIsoDate, type TodayData, type TodayDraft } from '@bubo/domain';
import { useMemo } from 'react';

import { Screen } from '../../design-system';
import { HomeHeader } from '../../features/home/HomeHeader';
import { NextStepSection } from '../../features/home/NextStepSection';
import { CognitiveWeekSection, DailyMissionSection } from '../../features/home/sections';
import { useRecoveryDraft } from '../../features/session/RecoveryCard';
import { useDueCards, usePreferences, useShelf, useStats } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { FadeIn } from '../../lib/motion';

function queryData<T>({ data, isError }: { data: T | undefined; isError: boolean }): TodayData<T> {
  if (isError) return { state: 'error' };
  return data === undefined ? { state: 'loading' } : { state: 'ready', value: data };
}

/** Hoje — the north-star screen. The next action and every number use real account data. */
export default function TodayScreen() {
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const saved = useRecoveryDraft(userId);
  const stats = useStats(userId);
  const shelf = useShelf(userId);
  const due = useDueCards(userId);
  const preferences = usePreferences(userId);
  const weekDates = stats.data?.weekActiveDates;
  const activeDates = useMemo(() => (weekDates ? new Set<string>(weekDates) : null), [weekDates]);
  if (auth.status !== 'ready') return null;

  const reading = shelf.data?.entries.find((entry) => entry.status === 'reading') ?? null;
  const draft: TodayData<TodayDraft | null> =
    saved.result.state === 'ready'
      ? {
          state: 'ready',
          value: saved.result.value
            ? {
                shelfEntryId: saved.result.value.shelfEntryId,
                needsSave: saved.result.value.endedAt !== null,
              }
            : null,
        }
      : saved.result;
  const action = selectTodayAction({
    today: toLocalIsoDate(new Date()),
    draft,
    readingEntryId: queryData({
      data: shelf.data ? (reading?.id ?? null) : undefined,
      isError: shelf.isError,
    }),
    reading: queryData(stats),
    reviewCount: queryData({ data: due.data?.cards.length, isError: due.isError }),
  });
  const sections = [
    <NextStepSection
      key="next"
      action={action}
      reading={reading}
      waitingForNetwork={[stats, shelf, due].some((query) => query.fetchStatus === 'paused')}
      onRetry={() => {
        if (action.kind === 'retry' && action.source === 'draft') saved.retry();
        else void Promise.all([stats.refetch(), shelf.refetch(), due.refetch()]);
      }}
    />,
    <CognitiveWeekSection
      key="week"
      activeDates={activeDates}
      focusedMinutes={stats.data?.focusedMinutesThisWeek ?? null}
    />,
    <DailyMissionSection
      key="mission"
      readToday={stats.data?.readToday ?? null}
      focusedMinutesToday={stats.data?.focusedMinutesToday ?? null}
      goalMinutes={preferences.data?.dailyFocusMinutes ?? null}
    />,
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
