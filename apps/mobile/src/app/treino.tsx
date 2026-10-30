import { type RecallCard } from '@bubo/contracts';
import { stableBucket, toLocalIsoDate } from '@bubo/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, View } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  ProgressBar,
  Text,
} from '../design-system';
import { usePracticeCards } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { FadeIn } from '../lib/motion';
import { fontFamily, useTheme } from '../theme';

type Mode = 'escaparam' | 'relampago';

const ROUND_SECONDS = 60;
const PRACTICE_NOTE = 'Treino: não muda sua agenda de revisões nem dá XP.';

/** A different, stable order per day and round, without randomness during render. */
function dealt(cards: readonly RecallCard[], seed: string): RecallCard[] {
  return [...cards].sort(
    (a, b) =>
      stableBucket(`${seed}:${a.id}`, 1_000_003) - stableBucket(`${seed}:${b.id}`, 1_000_003) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Practice decks of Revisar (ADR-045). Nothing here is sent to the API: the reader flips cards
 * and counts what they remembered on this device only. Real reviews keep their schedule and XP.
 */
export default function PracticeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { modo } = useLocalSearchParams<{ modo?: string }>();
  const mode: Mode = modo === 'relampago' ? 'relampago' : 'escaparam';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const practice = usePracticeCards(userId);
  // Frozen when the practice starts, so a background refetch never reshuffles it.
  const [deck, setDeck] = useState<RecallCard[] | null>(null);
  if (deck === null && practice.data) {
    setDeck(
      mode === 'relampago'
        ? dealt(practice.data.lightning, toLocalIsoDate(new Date()))
        : practice.data.slipped,
    );
  }
  const title = mode === 'relampago' ? 'Relâmpago de 60s' : 'Cards que escaparam';

  if (deck === null) {
    return (
      <FormScreen title={title}>
        {practice.isError ? (
          <EmptyState
            mascot="error"
            title="Não foi possível carregar"
            description="Verifique sua conexão e tente de novo."
            action={
              <Button
                label="Tentar de novo"
                icon="refresh"
                fullWidth
                onPress={() => void practice.refetch()}
              />
            }
          />
        ) : (
          <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando treino" />
        )}
      </FormScreen>
    );
  }
  if (deck.length === 0) {
    return (
      <FormScreen title={title}>
        <EmptyState
          mascot="emptyReview"
          title="Nada para treinar agora"
          description={
            mode === 'relampago'
              ? 'O relâmpago usa cards que você já revisou e que não vencem hoje.'
              : 'Nenhum card escapou nos últimos 30 dias. Bom sinal!'
          }
          action={<Button label="Voltar" fullWidth onPress={() => router.back()} />}
        />
      </FormScreen>
    );
  }
  return mode === 'relampago' ? <LightningRound deck={deck} /> : <SlippedRound deck={deck} />;
}

function PracticeCard({ card, revealed }: { card: RecallCard; revealed: boolean }) {
  const theme = useTheme();
  return (
    <Card>
      <Chip label={card.bookTitle} icon="menu-book" />
      <Text variant="title" accessibilityRole="header">
        {card.prompt}
      </Text>
      {revealed ? (
        <FadeIn>
          <Card tone="muted" style={{ gap: theme.spacing.xs }}>
            <Text variant="caption" color="accentText">
              Sua nota
            </Text>
            <Text variant="bodyLg">
              {card.answer ??
                'Você não deixou uma nota neste card. Compare com o livro, com calma.'}
            </Text>
          </Card>
        </FadeIn>
      ) : (
        <Text variant="body" color="textMuted">
          Tente lembrar antes de virar.
        </Text>
      )}
    </Card>
  );
}

/** One lapsed card at a time: try, flip, say whether it came back now. */
function SlippedRound({ deck }: { deck: readonly RecallCard[] }) {
  const theme = useTheme();
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [remembered, setRemembered] = useState(0);
  const card = deck[index];

  function mark(back: boolean) {
    if (back) {
      haptics.success();
      setRemembered((value) => value + 1);
    } else {
      haptics.selection();
    }
    setRevealed(false);
    setIndex((value) => value + 1);
  }

  if (!card) {
    return (
      <FormScreen
        back={false}
        footer={<Button label="Voltar para Revisar" icon="check" onPress={() => router.back()} />}
      >
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <BuboMascot
            state={remembered * 2 >= deck.length ? 'recallCorrect' : 'recallPrompt'}
            size={160}
          />
          <Text variant="display" align="center" accessibilityRole="header">
            Treino feito
          </Text>
          <Text variant="bodyLg" color="textMuted" align="center">
            Você lembrou {remembered} de {deck.length}. Eles voltam na revisão do dia certo, sem
            pressa.
          </Text>
          <Text variant="bodySm" color="textMuted" align="center">
            {PRACTICE_NOTE}
          </Text>
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Cards que escaparam"
      leading="close"
      headerRight={
        <Text
          variant="label"
          color="accentText"
          accessibilityLabel={`Card ${index + 1} de ${deck.length}`}
        >
          {index + 1}/{deck.length}
        </Text>
      }
      footer={
        revealed ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              label="Ainda não"
              variant="secondary"
              icon="replay"
              compact
              style={{ flex: 1 }}
              onPress={() => mark(false)}
            />
            <Button
              label="Lembrei agora"
              icon="check"
              compact
              style={{ flex: 1.3 }}
              onPress={() => mark(true)}
            />
          </View>
        ) : (
          <Button
            label="Mostrar minha nota"
            icon="visibility"
            onPress={() => {
              setRevealed(true);
              AccessibilityInfo.announceForAccessibility('Nota revelada.');
            }}
          />
        )
      }
    >
      <Text variant="bodySm" color="textMuted" align="center">
        {PRACTICE_NOTE}
      </Text>
      <FadeIn key={card.id}>
        <PracticeCard card={card} revealed={revealed} />
      </FadeIn>
    </FormScreen>
  );
}

/** Sixty seconds: flip as many cards as you can and count the ones that came back. */
function LightningRound({ deck: firstDeck }: { deck: readonly RecallCard[] }) {
  const theme = useTheme();
  const router = useRouter();
  const [round, setRound] = useState(0);
  const [deck, setDeck] = useState(firstDeck);
  const [phase, setPhase] = useState<'ready' | 'running' | 'done'>('ready');
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [remembered, setRemembered] = useState(0);
  const finishedAt = useRef<number | null>(null);
  const elapsed = phase === 'running' ? Math.max(0, now - startedAt) / 1000 : 0;
  const left = Math.max(0, Math.ceil(ROUND_SECONDS - elapsed));
  const card = deck[index];

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'running' && (elapsed >= ROUND_SECONDS || !card)) {
      finishedAt.current = Math.min(ROUND_SECONDS, Math.round(elapsed));
      setPhase('done');
      haptics.success();
      AccessibilityInfo.announceForAccessibility(
        `Fim do relâmpago. ${remembered} ${remembered === 1 ? 'lembrado' : 'lembrados'}.`,
      );
    }
  }, [phase, elapsed, card, remembered]);

  function start() {
    const stamp = Date.now();
    haptics.commit();
    finishedAt.current = null;
    setStartedAt(stamp);
    setNow(stamp);
    setIndex(0);
    setRevealed(false);
    setRemembered(0);
    setPhase('running');
  }

  function mark(back: boolean) {
    if (phase !== 'running') return;
    if (back) {
      haptics.success();
      setRemembered((value) => value + 1);
    } else {
      haptics.selection();
    }
    setRevealed(false);
    setIndex((value) => value + 1);
  }

  if (phase === 'ready' || phase === 'done') {
    const seen = phase === 'done' ? index : 0;
    const ranOut = phase === 'done' && seen >= deck.length;
    return (
      <FormScreen
        title="Relâmpago de 60s"
        leading="close"
        footer={
          <View style={{ gap: theme.spacing.sm }}>
            <Button
              label={phase === 'done' ? 'Jogar de novo' : 'Começar'}
              icon="bolt"
              onPress={() => {
                if (phase === 'done') {
                  const next = round + 1;
                  setRound(next);
                  setDeck(dealt(firstDeck, `${toLocalIsoDate(new Date())}:${next}`));
                }
                start();
              }}
            />
            {phase === 'done' ? (
              <Button
                label="Voltar para Revisar"
                variant="secondary"
                onPress={() => router.back()}
              />
            ) : null}
          </View>
        }
      >
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <BuboMascot
            state={phase === 'done' ? 'sessionComplete' : 'recallPrompt'}
            size={150}
            animated
          />
          {phase === 'done' ? (
            <>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: fontFamily.black,
                  fontSize: 64,
                  lineHeight: 72,
                  color: theme.colors.accentText,
                }}
              >
                {remembered}
              </Text>
              <Text variant="title" align="center">
                {remembered === 1 ? 'lembrado' : 'lembrados'}{' '}
                {ranOut ? `em ${finishedAt.current ?? ROUND_SECONDS}s` : 'em 60s'}
              </Text>
              <Text variant="body" color="textMuted" align="center">
                {ranOut
                  ? `Você passou por todos os ${deck.length} cards antes do tempo.`
                  : `${seen} ${seen === 1 ? 'card visto' : 'cards vistos'} nesta rodada.`}
              </Text>
            </>
          ) : (
            <>
              <Text variant="display" align="center" accessibilityRole="header">
                Quantos você lembra em 1 minuto?
              </Text>
              <Text variant="body" color="textMuted" align="center">
                Vire cada card e diga se lembrou.{' '}
                {deck.length === 1 ? '1 card' : `${deck.length} cards`} na pilha.
              </Text>
            </>
          )}
          <Text variant="bodySm" color="textMuted" align="center">
            {PRACTICE_NOTE}
          </Text>
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      title="Relâmpago de 60s"
      leading="close"
      headerRight={
        <Text
          variant="labelLg"
          color={left <= 10 ? 'error' : 'accentText'}
          accessibilityRole="timer"
          accessibilityLabel={`${left} segundos restantes`}
          style={{ fontVariant: ['tabular-nums'] }}
        >
          0:{String(left).padStart(2, '0')}
        </Text>
      }
      footer={
        revealed ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              label="Não lembrei"
              variant="secondary"
              compact
              style={{ flex: 1 }}
              onPress={() => mark(false)}
            />
            <Button
              label="Lembrei"
              variant="success"
              icon="check"
              compact
              style={{ flex: 1 }}
              onPress={() => mark(true)}
            />
          </View>
        ) : (
          <Button label="Virar" icon="flip" onPress={() => setRevealed(true)} />
        )
      }
    >
      <ProgressBar
        percent={(left / ROUND_SECONDS) * 100}
        tone={left <= 10 ? 'orange' : 'primary'}
        accessibilityLabel={`${left} segundos restantes`}
      />
      <Text variant="label" color="textMuted" align="center">
        {remembered} {remembered === 1 ? 'lembrado' : 'lembrados'} até agora
      </Text>
      {card ? (
        <FadeIn key={`${round}:${card.id}`}>
          <PracticeCard card={card} revealed={revealed} />
        </FadeIn>
      ) : null}
    </FormScreen>
  );
}
