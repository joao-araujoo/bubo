import {
  buildCognitiveWeek,
  dailyStamps,
  selectTodayAction,
  toLocalIsoDate,
  type TodayData,
  type TodayDraft,
} from '@bubo/domain';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useContext, useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { OfflineBanner, ScreenBottomInset } from '../../design-system';
import { BookStage, StageGreeting, StageHeader } from '../../features/home/BookStage';
import { NextStepStage } from '../../features/home/NextStepStage';
import {
  DailyTicket,
  DayTiles,
  FriendsReading,
  ReplayBanner,
  SuggestionCard,
} from '../../features/home/sections';
import { useRecoveryDraft } from '../../features/session/RecoveryCard';
import { useDueCards, usePreferences, useShelf, useStats } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { FadeIn } from '../../lib/motion';
import { useTheme } from '../../theme';

function queryData<T>({ data, isError }: { data: T | undefined; isError: boolean }): TodayData<T> {
  if (isError) return { state: 'error' };
  return data === undefined ? { state: 'loading' } : { state: 'ready', value: data };
}

/**
 * Hoje (ADR-043): the current book on a stage painted with its own cover, the day tiles over it,
 * then the daily card, a real recommendation, friends reading and the month Replay.
 */
export default function TodayScreen() {
  const theme = useTheme();
  const router = useRouter();
  const bottomInset = useContext(ScreenBottomInset);
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const saved = useRecoveryDraft(userId);
  const stats = useStats(userId);
  const shelf = useShelf(userId);
  const due = useDueCards(userId);
  const preferences = usePreferences(userId);
  const weekDates = stats.data?.weekActiveDates;
  const week = useMemo(
    () => buildCognitiveWeek(new Date(), new Set<string>(weekDates ?? [])),
    [weekDates],
  );
  // The stage is dark whatever the cover: light status bar while Hoje is focused.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle(theme.scheme === 'dark' ? 'light' : 'dark');
    }, [theme.scheme]),
  );
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
  const actionEntryId =
    action.kind === 'continue' || action.kind === 'read' || action.kind === 'return'
      ? action.shelfEntryId
      : null;
  const entry =
    (actionEntryId
      ? shelf.data?.entries.find((candidate) => candidate.id === actionEntryId)
      : undefined) ?? reading;
  const goal = preferences.data?.dailyFocusMinutes ?? null;
  const minutesToday = stats.data?.focusedMinutesToday ?? null;
  const subtitle =
    minutesToday === null || goal === null
      ? null
      : minutesToday >= goal
        ? 'Meta de hoje cumprida. Mais um pouquinho?'
        : `Faltam ${goal - minutesToday} min pra fechar o dia.`;
  const dueCount = due.data ? due.data.cards.length : null;
  const stamps = stats.data
    ? dailyStamps({
        focusedMinutesToday: stats.data.focusedMinutesToday,
        goalMinutes: goal,
        readToday: stats.data.readToday,
        reviewedToday: stats.data.reviewedToday,
        dueCards: dueCount ?? stats.data.dueCards,
      })
    : null;

  const below = [
    stamps ? <DailyTicket key="ticket" stamps={stamps} /> : null,
    <SuggestionCard key="suggestion" userId={auth.userId} />,
    <FriendsReading key="friends" userId={auth.userId} />,
    <ReplayBanner key="replay" />,
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomInset + theme.spacing.xxl }}
      >
        <BookStage
          entry={entry}
          header={
            <StageHeader
              userId={auth.userId}
              streakDays={stats.data?.streakDays ?? null}
              xp={stats.data?.xpTotal ?? null}
            />
          }
          greeting={<StageGreeting name={auth.me.user.name} subtitle={subtitle} />}
        >
          <NextStepStage
            action={action}
            entry={entry}
            waitingForNetwork={[stats, shelf, due].some((query) => query.fetchStatus === 'paused')}
            onRetry={() => {
              if (action.kind === 'retry' && action.source === 'draft') saved.retry();
              else void Promise.all([stats.refetch(), shelf.refetch(), due.refetch()]);
            }}
          />
        </BookStage>
        <FadeIn index={0}>
          <DayTiles
            focusedMinutesToday={minutesToday}
            goalMinutes={goal}
            streakDays={stats.data?.streakDays ?? null}
            week={week}
            dueCount={dueCount}
            onGoal={() =>
              entry
                ? router.push({ pathname: '/sessao/[id]', params: { id: entry.id } })
                : router.navigate('/estante')
            }
          />
        </FadeIn>
        <View
          style={{
            paddingHorizontal: theme.sizes.gutter,
            paddingTop: theme.spacing.xl,
            gap: theme.spacing.xl,
          }}
        >
          <OfflineBanner />
          {below.map((section, index) =>
            section ? (
              <FadeIn key={section.key} index={index + 1}>
                {section}
              </FadeIn>
            ) : null,
          )}
        </View>
      </ScrollView>
    </View>
  );
}
