import { type RecallCard, type ReviewResult } from '@bubo/contracts';
import { toLocalIsoDate } from '@bubo/domain';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Keyboard,
  View,
} from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  Icon,
  InlineMessage,
  Text,
  TextField,
} from '../design-system';
import { GRADE_OPTIONS } from '../features/recall/grades';
import { ApiError } from '../lib/api/client';
import { useDueCards, useRefreshAfterReview, useReviewCard } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { FadeIn, useReducedMotion } from '../lib/motion';
import { motion, useTheme } from '../theme';

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
  const [selected, setSelected] = useState<(typeof GRADE_OPTIONS)[number] | null>(null);
  const [saved, setSaved] = useState<ReviewResult | null>(null);
  const locked = useRef(false);
  const advanced = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // One id per card attempt: retrying after a network error never counts twice.
  const reviewId = useRef(Crypto.randomUUID());

  async function grade(option: (typeof GRADE_OPTIONS)[number]) {
    if (locked.current) return;
    locked.current = true;
    setSelected(option);
    try {
      const result = await review.mutateAsync({
        cardId: card.id,
        body: { id: reviewId.current, grade: option.grade, localDate: toLocalIsoDate(new Date()) },
      });
      if (!mounted.current) return;
      if (option.grade >= 4) haptics.success();
      else haptics.selection();
      setSaved(result);
      AccessibilityInfo.announceForAccessibility(
        `${option.label}. Revisão salva. ${option.message}`,
      );
    } catch {
      locked.current = false;
      if (!mounted.current) return;
      haptics.error();
      AccessibilityInfo.announceForAccessibility('Não foi possível salvar. Tente novamente.');
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
      title="Hora de lembrar"
      eyebrow={`Lembrança ${index + 1} de ${total}`}
      footer={
        saved && selected ? (
          <FadeIn key="saved" style={{ gap: theme.spacing.md }}>
            <View
              style={{
                borderLeftWidth: theme.sizes.borderWidth,
                borderLeftColor: theme.colors[selected.color],
                paddingLeft: theme.spacing.md,
                gap: theme.spacing.sm,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <Icon name={selected.icon} color={selected.color} />
                <Text variant="labelLg" style={{ flex: 1 }}>
                  {selected.label} · revisão salva
                </Text>
              </View>
              <Text variant="bodySm">{selected.message}</Text>
            </View>
            <Button
              label={index + 1 === total ? 'Ver conclusão' : 'Próxima lembrança'}
              icon="arrow-forward"
              fullWidth
              onPress={() => {
                if (advanced.current) return;
                advanced.current = true;
                onGraded(saved);
              }}
            />
          </FadeIn>
        ) : revealed ? (
          <FadeIn key="grading" style={{ gap: theme.spacing.sm }}>
            <Text variant="label" align="center" color="textMuted">
              Quanto você lembrou?
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
              {GRADE_OPTIONS.map((option) => (
                <Button
                  key={option.grade}
                  label={option.label}
                  icon={option.icon}
                  variant={option.variant}
                  size="md"
                  compact
                  accessibilityHint={option.hint}
                  disabled={review.isPending}
                  loading={review.isPending && selected?.grade === option.grade}
                  style={{ flex: 1, minWidth: 0 }}
                  onPress={() => void grade(option)}
                />
              ))}
            </View>
          </FadeIn>
        ) : (
          <Button
            label="Mostrar minha nota"
            icon="visibility"
            fullWidth
            onPress={() => {
              Keyboard.dismiss();
              setRevealed(true);
              AccessibilityInfo.announceForAccessibility(
                'Nota revelada. Compare com o que você lembrou.',
              );
            }}
          />
        )
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <BuboMascot
          state={saved && selected ? selected.mascot : revealed ? 'reviewDue' : 'recallPrompt'}
          size={64}
          animated
        />
        <Card containerStyle={{ flex: 1 }} style={{ padding: theme.spacing.md }}>
          <Text variant="caption" color="accentText">
            {saved
              ? 'Bubo · um passo de cada vez'
              : revealed
                ? 'Bubo · confira com calma'
                : 'Bubo · sem espiar'}
          </Text>
          <Text variant="bodySm">
            {saved && selected
              ? selected.message
              : revealed
                ? 'Não precisa ser palavra por palavra. O que importa é a ideia.'
                : 'Conte com suas palavras o que ficou desta leitura.'}
          </Text>
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
          <FadeIn style={{ gap: theme.spacing.md }}>
            {attempt.trim() ? (
              <Card tone="muted">
                <Text variant="caption" color="textMuted">
                  Você lembrou
                </Text>
                <Text variant="body">{attempt.trim()}</Text>
              </Card>
            ) : null}
            <Card style={{ backgroundColor: theme.colors.primarySoft }}>
              <Text variant="caption" color="accentText">
                Sua nota
              </Text>
              <Text variant="bodyLg">
                {card.answer ??
                  'Você não deixou uma nota neste card. Compare com o livro e avalie com honestidade.'}
              </Text>
            </Card>
            {review.isError ? <InlineMessage tone="error" message={errorMessage} /> : null}
          </FadeIn>
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
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const announced = useRef(false);

  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      haptics.success();
      AccessibilityInfo.announceForAccessibility(
        'Sessão de revisão concluída. Seus resultados estão disponíveis.',
      );
    }
    if (reduced) {
      progress.setValue(1);
      return;
    }
    // One shared clock: arrive, hold, celebrate gently, then settle. No loops or navigation gate.
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.slow * 3 + motion.base + motion.fast,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced]);

  const phase = (start: number, end: number) =>
    reduced
      ? 1
      : progress.interpolate({
          inputRange: [start, end],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        });

  return (
    <FormScreen
      back={false}
      footer={
        <View>
          <Animated.View
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              top: -theme.spacing.xs,
              bottom: -theme.spacing.xs,
              left: -theme.spacing.xs,
              right: -theme.spacing.xs,
              borderRadius: theme.radii.pill,
              borderWidth: theme.sizes.borderWidth,
              borderColor: theme.colors.purpleLight,
              opacity: reduced
                ? 0
                : progress.interpolate({
                    inputRange: [0, 0.7, 0.85, 1],
                    outputRange: [0, 0, 1, 0],
                  }),
            }}
          />
          <Button label="Concluir e voltar" icon="check" fullWidth onPress={() => router.back()} />
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
        <View style={{ padding: theme.spacing.lg }}>
          <Animated.View
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: theme.colors.primarySoft,
              borderRadius: theme.radii.pill,
              opacity: phase(0, 0.3),
              transform: [
                {
                  scale: reduced
                    ? 1
                    : progress.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.8, 1.06, 1],
                      }),
                },
              ],
            }}
          />
          <Animated.View
            style={{
              opacity: phase(0, 0.2),
              transform: [
                {
                  translateY: reduced
                    ? 0
                    : progress.interpolate({
                        inputRange: [0, 0.25, 0.4, 0.55, 0.75, 1],
                        outputRange: [motion.enterOffset * 2, 0, 0, -motion.enterOffset, 0, 0],
                      }),
                },
                {
                  scale: reduced
                    ? 1
                    : progress.interpolate({
                        inputRange: [0, 0.25, 0.4, 0.55, 0.75, 1],
                        outputRange: [0.9, 1, 1, 1.03, 1, 1],
                      }),
                },
              ],
            }}
          >
            <BuboMascot state="sessionComplete" size={180} />
          </Animated.View>
        </View>
        <Animated.View style={{ opacity: phase(0.25, 0.45) }}>
          <Text variant="display" align="center" accessibilityRole="header">
            Isso ficou com você.
          </Text>
        </Animated.View>
        <Animated.View
          style={{ alignItems: 'center', gap: theme.spacing.md, opacity: phase(0.45, 0.65) }}
        >
          {streakDays > 0 ? (
            <Chip
              label={streakDays > 1 ? `${streakDays} dias seguidos` : 'Primeiro dia da sequência'}
              tone="orange"
              icon="local-fire-department"
              iconColor="orange"
              align="center"
            />
          ) : null}
          <Text variant="bodyLg" color="textMuted" align="center">
            {reviewed === 1 ? '1 card revisado' : `${reviewed} cards revisados`} · +{xp} XP. Cada
            lembrança espaçada fica mais forte.
          </Text>
        </Animated.View>
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
