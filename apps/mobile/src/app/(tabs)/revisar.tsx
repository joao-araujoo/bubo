import { type DailyStamp, dailyStamps, toLocalIsoDate } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, Card, EmptyState, InlineMessage, Screen, Text } from '../../design-system';
import { dueLabel } from '../../features/recall/grades';
import {
  DayStampCard,
  MonthChallengeCard,
  ReviewStack,
  TrainingTiles,
} from '../../features/recall/ReviewTab';
import { TabHeader } from '../../features/shell/TabHeader';
import {
  useDueCards,
  usePracticeCards,
  usePreferences,
  useShelf,
  useStats,
} from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { useTheme } from '../../theme';

/** Revisar (ADR-045): today's stack, the daily stamp card, the month challenge and practice. */
export default function ReviewTab() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const due = useDueCards(userId);
  const stats = useStats(userId);
  const preferences = usePreferences(userId);
  const practice = usePracticeCards(userId);
  const shelf = useShelf(userId);
  const today = toLocalIsoDate(new Date());
  const reading = shelf.data?.entries.find((entry) => entry.status === 'reading') ?? null;
  const dueCount = due.data?.cards.length ?? 0;
  const stamps = stats.data
    ? dailyStamps({
        focusedMinutesToday: stats.data.focusedMinutesToday,
        goalMinutes: preferences.data?.dailyFocusMinutes ?? null,
        readToday: stats.data.readToday,
        reviewedToday: stats.data.reviewedToday,
        dueCards: due.data ? dueCount : stats.data.dueCards,
      })
    : null;

  function openStamp(stamp: DailyStamp) {
    if (stamp.id === 'review') {
      if (dueCount > 0) router.push('/revisao');
      return;
    }
    if (reading) router.push({ pathname: '/sessao/[id]', params: { id: reading.id } });
    else router.navigate('/estante');
  }

  let stack: ReactNode;
  if (due.isPending) {
    stack = (
      <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando revisões" />
    );
  } else if (due.isError) {
    stack = (
      <Card>
        <InlineMessage tone="error" message="Não foi possível carregar suas revisões agora." />
        <Button
          label="Tentar de novo"
          variant="secondary"
          size="md"
          icon="refresh"
          onPress={() => void due.refetch()}
        />
      </Card>
    );
  } else if (due.data.cards.length === 0 && due.data.dueCount > 0) {
    // The reader's daily limit (Preferências) is reached; the rest waits for tomorrow, in order.
    const waiting = due.data.dueCount;
    stack = (
      <Card>
        <EmptyState
          mascot="sessionComplete"
          title="Meta de revisões cumprida"
          description={`${waiting === 1 ? '1 card volta' : `${waiting} cards voltam`} amanhã. Você pode ajustar o limite diário.`}
          action={
            <Button
              label="Ajustar limite diário"
              icon="tune"
              variant="secondary"
              fullWidth
              onPress={() => router.push('/configuracoes/leitura')}
            />
          }
        />
      </Card>
    );
  } else if (due.data.cards[0]) {
    const beyond = due.data.dueCount - dueCount;
    stack = (
      <View style={{ gap: theme.spacing.sm }}>
        <ReviewStack
          first={due.data.cards[0]}
          count={dueCount}
          onStart={() => router.push('/revisao')}
        />
        {beyond > 0 ? (
          <Text variant="bodySm" color="textMuted" align="center">
            {`Seu limite diário é ${due.data.dailyLimit}. ${beyond === 1 ? 'Mais 1 lembrança volta' : `Mais ${beyond} lembranças voltam`} amanhã.`}
          </Text>
        ) : null}
      </View>
    );
  } else if (due.data.totalCards > 0) {
    stack = (
      <Card>
        <EmptyState
          mascot="emptyReview"
          title="Tudo revisado por hoje"
          description={
            due.data.nextDueDate
              ? `Próxima revisão: ${dueLabel(due.data.nextDueDate, today)}.`
              : 'Você está em dia.'
          }
        />
      </Card>
    );
  } else {
    stack = (
      <Card>
        <EmptyState
          mascot="emptyReview"
          title="Nenhum card ainda"
          description="Conclua uma sessão de leitura ou crie um card na página do livro."
          action={
            <Button
              label="Ir para a Estante"
              icon="menu-book"
              fullWidth
              onPress={() => router.navigate('/estante')}
            />
          }
        />
      </Card>
    );
  }

  return (
    <Screen header={<TabHeader title="Revisar" subtitle="Hora de lembrar" />}>
      <View style={{ gap: theme.spacing.xl - theme.spacing.xxs }}>
        {stack}
        {stamps ? <DayStampCard stamps={stamps} dueCount={dueCount} onOpen={openStamp} /> : null}
        {stats.data ? <MonthChallengeCard stats={stats.data} /> : null}
        {due.data && due.data.totalCards > 0 ? (
          <TrainingTiles
            practice={practice.data}
            failed={practice.isError}
            onOpen={(modo) => router.push({ pathname: '/treino', params: { modo } })}
          />
        ) : null}
        {due.data && due.data.totalCards > 0 ? (
          <Text variant="bodySm" color="textMuted" align="center">
            {due.data.totalCards === 1
              ? '1 card no total'
              : `${due.data.totalCards} cards no total`}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
