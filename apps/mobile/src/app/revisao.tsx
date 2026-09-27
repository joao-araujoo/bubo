import { type RecallCard, type ReviewResult } from '@bubo/contracts';
import { toLocalIsoDate } from '@bubo/domain';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  InlineMessage,
  Text,
  TextField,
} from '../design-system';
import { GRADE_OPTIONS } from '../features/recall/grades';
import { ApiError } from '../lib/api/client';
import { useDueCards, useRefreshAfterReview, useReviewCard } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

function CardStep({
  card,
  index,
  total,
  onGraded,
}: {
  card: RecallCard;
  index: number;
  total: number;
  onGraded: (result: ReviewResult) => void;
}) {
  const theme = useTheme();
  const review = useReviewCard();
  const [attempt, setAttempt] = useState('');
  const [revealed, setRevealed] = useState(false);
  // One id per card attempt: retrying after a network error never counts twice.
  const reviewId = useRef(Crypto.randomUUID());

  async function grade(value: 1 | 3 | 4 | 5) {
    try {
      const result = await review.mutateAsync({
        cardId: card.id,
        body: { id: reviewId.current, grade: value, localDate: toLocalIsoDate(new Date()) },
      });
      if (value >= 3) haptics.success();
      else haptics.press();
      onGraded(result);
    } catch {
      haptics.error();
    }
  }

  const errorMessage =
    review.error instanceof ApiError &&
    (review.error.code === 'NETWORK_ERROR' || review.error.code === 'TIMEOUT')
      ? 'Sem conexão. Toque de novo na sua resposta para salvar.'
      : review.error instanceof ApiError && review.error.code === 'CONFLICT'
        ? 'Este card já foi revisado ou ainda não está na hora.'
        : 'Não foi possível salvar esta revisão. Tente de novo.';

  return (
    <FormScreen
      step={{ current: index + 1, total }}
      footer={
        revealed ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="label" align="center" color="textMuted">
              Quanto você lembrou?
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {GRADE_OPTIONS.map((option) => (
                <Button
                  key={option.grade}
                  label={option.label}
                  icon={option.icon}
                  variant={option.variant}
                  size="md"
                  accessibilityHint={option.hint}
                  disabled={review.isPending}
                  style={{ flexGrow: 1, flexBasis: '45%' }}
                  onPress={() => void grade(option.grade)}
                />
              ))}
            </View>
          </View>
        ) : (
          <Button
            label="Mostrar minha nota"
            icon="visibility"
            fullWidth
            onPress={() => {
              haptics.press();
              setRevealed(true);
            }}
          />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <BuboMascot state="recallPrompt" size={64} />
        <Card containerStyle={{ flex: 1 }} style={{ padding: theme.spacing.md }}>
          <Text variant="caption" color="accentText">
            Bubo · sem espiar
          </Text>
          <Text variant="bodySm">Conte com suas palavras o que ficou desta leitura.</Text>
        </Card>
      </View>
      <Card>
        <Chip label={card.bookTitle} icon="menu-book" />
        <Text variant="title" accessibilityRole="header">
          {card.prompt}
        </Text>
        {!revealed ? (
          <>
            <Text variant="body" color="textMuted">
              Sem espiar: tente lembrar antes de ver sua nota. Escrever ajuda — isso fica só no seu
              aparelho.
            </Text>
            <TextField
              label="O que você lembra?"
              icon="edit-note"
              placeholder="Com suas palavras…"
              value={attempt}
              onChangeText={setAttempt}
              multiline
              textAlignVertical="top"
            />
          </>
        ) : (
          <>
            {attempt.trim() ? (
              <Card tone="muted">
                <Text variant="caption" color="textMuted">
                  Você lembrou
                </Text>
                <Text variant="body">{attempt.trim()}</Text>
              </Card>
            ) : null}
            <Card>
              <Text variant="caption" color="accentText">
                Sua nota
              </Text>
              <Text variant="bodyLg">
                {card.answer ??
                  'Você não deixou uma nota neste card. Compare com o livro e avalie com honestidade.'}
              </Text>
            </Card>
            {review.isError ? <InlineMessage tone="error" message={errorMessage} /> : null}
          </>
        )}
      </Card>
    </FormScreen>
  );
}

function SummaryStep({
  reviewed,
  xp,
  streakDays,
}: {
  reviewed: number;
  xp: number;
  streakDays: number;
}) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <FormScreen
      back={false}
      footer={<Button label="Concluir" icon="check" fullWidth onPress={() => router.back()} />}
    >
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <BuboMascot state="recallCorrect" size={180} />
        {streakDays > 0 ? (
          <Chip
            label={streakDays > 1 ? `${streakDays} dias seguidos` : 'Primeiro dia da sequência'}
            tone="orange"
            icon="local-fire-department"
            iconColor="orange"
            align="center"
          />
        ) : null}
        <Text variant="display" align="center" accessibilityRole="header">
          Isso ficou com você.
        </Text>
        <Text variant="bodyLg" color="textMuted" align="center">
          {reviewed === 1 ? '1 card revisado' : `${reviewed} cards revisados`} · +{xp} XP. Cada
          lembrança espaçada fica mais forte.
        </Text>
      </View>
    </FormScreen>
  );
}

/** Review session: one due card at a time — try to remember, reveal, self-grade (SM-2). */
export default function ReviewScreen() {
  const theme = useTheme();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const due = useDueCards(userId);
  const refresh = useRefreshAfterReview(userId ?? '');
  // The queue is frozen when the session starts, so grading never reshuffles it.
  const [queue, setQueue] = useState<RecallCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [xp, setXp] = useState(0);
  const [streakDays, setStreakDays] = useState(0);

  // Leaving at any point refreshes Hoje/Revisar counts (each review is already saved).
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => () => void refreshRef.current(), []);

  if (queue === null && due.data) setQueue(due.data.cards);

  if (!userId || (queue === null && due.isPending)) {
    return (
      <FormScreen>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando revisões" />
      </FormScreen>
    );
  }
  if (queue === null) {
    return (
      <FormScreen>
        <EmptyState
          mascot="error"
          title="Não foi possível carregar"
          description="Verifique sua conexão e tente de novo."
          action={
            <Button
              label="Tentar de novo"
              icon="refresh"
              fullWidth
              onPress={() => void due.refetch()}
            />
          }
        />
      </FormScreen>
    );
  }
  if (queue.length === 0) {
    return (
      <FormScreen>
        <EmptyState
          mascot="emptyReview"
          title="Nada para revisar agora"
          description="Seus cards voltam no dia certo. Leia e deixe uma reflexão para criar novos."
        />
      </FormScreen>
    );
  }
  if (index >= queue.length)
    return <SummaryStep reviewed={queue.length} xp={xp} streakDays={streakDays} />;

  const card = queue[index];
  if (!card) return null;
  return (
    <CardStep
      key={card.id}
      card={card}
      index={index}
      total={queue.length}
      onGraded={(result) => {
        setXp((value) => value + result.xpEarned);
        setStreakDays(result.stats.streakDays);
        setIndex(index + 1);
      }}
    />
  );
}
