import { type ReadingSession, type ShelfEntry } from '@bubo/contracts';
import { MIN_SESSION_SECONDS } from '@bubo/domain';
import { xpForReadingSession } from '@bubo/scoring';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Animated, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Book3D, BuboMascot, Icon, InlineMessage, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { FadeIn, useAmbientLoop, useMotionValue } from '../../lib/motion';
import { fontFamily, readingPalette, useTheme } from '../../theme';
import { BeforeReadingCard } from './BeforeReadingCard';
import { type SessionDraft, type SessionDraftPersist } from './draft-storage';
import { PageSheet } from './PageSheet';
import {
  LampGlow,
  SceneButton,
  SceneIconButton,
  ScenePill,
  SceneTextButton,
  useLightStatusBar,
} from './scene';
import { useConfirmLeave } from './useConfirmLeave';
import { formatDuration, useFocusTimer } from './useFocusTimer';

const LEAF_GAP = 5;
const LEAVES_PER_ROW = 15;

/**
 * The night "marcador" (ADR-044): the book on a dark desk under a lamp, a ribbon bookmark that
 * grows toward the session target, one leaf per focused minute and a page sheet on finishing.
 * Behaviour is the durable timer of ADR-032; only the scene changed.
 */
export function TimerStep({
  entry,
  sessions,
  historyState,
  draft,
  persist,
  busy,
  error,
  onDiscard,
  targetMinutes,
  streakDays,
}: {
  entry: ShelfEntry;
  sessions: readonly ReadingSession[];
  historyState: 'ready' | 'loading' | 'unavailable';
  draft: SessionDraft;
  persist: SessionDraftPersist;
  busy: boolean;
  error: string | null;
  onDiscard: () => void;
  targetMinutes: number;
  streakDays: number | null;
}) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const timer = useFocusTimer(draft, persist);
  useLightStatusBar();
  const canFinish = timer.elapsedSeconds >= MIN_SESSION_SECONDS;
  const active = timer.status !== 'idle';
  const running = timer.status === 'running';
  useConfirmLeave(active);
  const [sheet, setSheet] = useState(false);
  const [sheetBusy, setSheetBusy] = useState(false);
  const resumeOnClose = useRef(false);

  const target = Math.max(1, Math.round(targetMinutes));
  const minutes = Math.floor(timer.elapsedSeconds / 60);
  const goalDone = timer.elapsedSeconds >= target * 60;
  const progress = Math.min(1, timer.elapsedSeconds / (target * 60));
  const xp = xpForReadingSession({ focusedMinutes: minutes });
  const stageHeight = Math.round(Math.min(360, Math.max(250, height * 0.4)));
  const bookWidth = Math.round(stageHeight * 0.43);
  const owlSize = Math.round(Math.min(stageHeight * 0.36, width * 0.3));
  const breathing = useAmbientLoop(3400, running);
  const leavesWidth = width - 2 * (theme.sizes.gutter + theme.spacing.md);
  const perRow = Math.min(target, LEAVES_PER_ROW);
  const leafWidth = (leavesWidth - (perRow - 1) * LEAF_GAP) / perRow;
  const status =
    timer.status === 'idle'
      ? 'pronto quando você estiver'
      : timer.status === 'running'
        ? goalDone
          ? 'meta cumprida · lendo'
          : `de ${formatDuration(target * 60)} · lendo`
        : timer.reachedCap
          ? 'limite de 4 horas · termine para salvar'
          : 'pausado';

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function openSheet() {
    if (!canFinish || busy) return;
    resumeOnClose.current = false;
    if (timer.status === 'running') {
      try {
        await timer.pause();
        resumeOnClose.current = true;
      } catch {
        return;
      }
    }
    setSheet(true);
  }

  function closeSheet() {
    setSheet(false);
    if (resumeOnClose.current) {
      resumeOnClose.current = false;
      void timer.start().catch(() => undefined);
    }
  }

  async function confirmPage(page: number) {
    setSheetBusy(true);
    try {
      await persist((current) => ({ ...current, page: String(page) }));
      resumeOnClose.current = false;
      haptics.commit();
      // Ending the draft swaps this step for the recall card.
      await timer.finish();
    } catch {
      setSheetBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: readingPalette.night, overflow: 'hidden' }}>
      <LampGlow />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingTop: insets.top + theme.spacing.sm,
          paddingHorizontal: theme.sizes.gutter,
        }}
      >
        <SceneIconButton icon="close" label="Sair da leitura" onPress={leave} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            variant="label"
            numberOfLines={1}
            style={{ color: readingPalette.nightText, fontSize: 15 }}
          >
            {entry.book.title}
          </Text>
          <Text variant="bodySm" style={{ color: readingPalette.nightMuted }}>
            desde a pág. {entry.currentPage}
          </Text>
        </View>
        {streakDays !== null ? (
          <View
            accessible
            accessibilityLabel={`Sequência de ${streakDays} ${streakDays === 1 ? 'dia' : 'dias'}`}
            style={{
              minWidth: theme.sizes.touchTarget,
              height: theme.sizes.touchTarget,
              paddingHorizontal: theme.spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.xxs,
              borderRadius: theme.radii.pill,
              borderWidth: 1.5,
              borderColor: readingPalette.glassBorder,
              backgroundColor: readingPalette.glass,
            }}
          >
            <Icon name="local-fire-department" size={18} tint={readingPalette.flame} />
            <Text variant="label" style={{ color: readingPalette.nightText, fontSize: 15 }}>
              {streakDays}
            </Text>
          </View>
        ) : (
          <View style={{ width: theme.sizes.touchTarget }} />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: theme.spacing.lg }}
      >
        <View style={{ height: stageHeight, marginTop: theme.spacing.md }}>
          <View
            style={{
              position: 'absolute',
              left: '50%',
              top: theme.spacing.sm,
              marginLeft: -Math.round(bookWidth * 0.6),
            }}
          >
            <Book3D
              title={entry.book.title}
              author={entry.book.author}
              coverUrls={entry.book.coverUrls}
              totalPages={entry.book.totalPages}
              width={bookWidth}
              priority="high"
            />
            <Ribbon bookWidth={bookWidth} progress={progress} swaying={running} />
          </View>
          <Animated.View
            style={{
              position: 'absolute',
              right: theme.sizes.gutter + 2,
              top: Math.round(stageHeight * 0.47),
              transform: [
                { translateY: breathing.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
                {
                  scaleY: breathing.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }),
                },
              ],
            }}
          >
            <BuboMascot pose="deepReading" size={owlSize} decorative={false} />
          </Animated.View>
        </View>

        <View style={{ alignItems: 'center', marginTop: -theme.spacing.sm }}>
          <Text
            accessibilityRole="timer"
            accessibilityLabel={`Tempo focado: ${formatDuration(timer.elapsedSeconds)}`}
            style={{
              fontFamily: fontFamily.black,
              fontSize: 66,
              lineHeight: 74,
              letterSpacing: -2,
              color: readingPalette.nightText,
              fontVariant: ['tabular-nums'],
            }}
          >
            {formatDuration(timer.elapsedSeconds)}
          </Text>
          <Text variant="bodyStrong" style={{ color: readingPalette.nightMuted }}>
            {status}
          </Text>
        </View>

        <View
          style={{
            paddingHorizontal: theme.sizes.gutter + theme.spacing.md,
            paddingTop: theme.spacing.lg,
          }}
        >
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${Math.min(minutes, target)} de ${target} minutos lidos`}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: LEAF_GAP }}
          >
            {Array.from({ length: target }, (_, index) => (
              <Leaf
                key={index}
                width={leafWidth}
                state={index < minutes ? 'done' : index === minutes && !goalDone ? 'now' : 'ahead'}
                pulsing={running}
              />
            ))}
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: theme.spacing.xs,
            }}
          >
            <Text variant="bodySm" style={{ color: readingPalette.nightMuted }}>
              uma folha por minuto
            </Text>
            {active ? (
              <Text
                variant="bodySm"
                style={{ color: readingPalette.gold, fontFamily: fontFamily.bold }}
              >
                +{xp} XP até agora
              </Text>
            ) : null}
          </View>
        </View>

        <View
          style={{
            gap: theme.spacing.md,
            paddingHorizontal: theme.sizes.gutter,
            paddingTop: theme.spacing.lg,
          }}
        >
          {active && canFinish ? (
            <FadeIn>
              <ScenePill icon="local-fire-department">
                Hoje já pode contar pra sua sequência
              </ScenePill>
            </FadeIn>
          ) : null}
          {draft.goalNoticeShown ? (
            <FadeIn>
              <ScenePill icon="check-circle" tone="glass">
                5 minutos lidos! Siga ou termine quando quiser.
              </ScenePill>
            </FadeIn>
          ) : timer.goalNoticeError ? (
            <>
              <InlineMessage
                tone="error"
                message="Não foi possível guardar o aviso da meta neste aparelho. Você pode continuar lendo ou tentar novamente."
              />
              <SceneTextButton
                label="Tentar guardar aviso"
                icon="refresh"
                disabled={busy}
                onPress={() => void timer.acknowledgeGoal()}
              />
            </>
          ) : null}
          {error ? <InlineMessage tone="error" message={error} /> : null}
          {timer.status === 'idle' ? (
            <BeforeReadingCard
              shelfEntryId={entry.id}
              currentPage={entry.currentPage}
              sessions={sessions}
              historyState={historyState}
              busy={busy}
            />
          ) : null}
        </View>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: theme.sizes.gutter,
          paddingTop: theme.spacing.sm,
          paddingBottom: insets.bottom + theme.spacing.lg,
          gap: theme.spacing.xs,
        }}
      >
        {active && !canFinish ? (
          <Text variant="bodySm" align="center" style={{ color: readingPalette.nightMuted }}>
            Dá pra terminar a partir de 1 minuto de leitura.
          </Text>
        ) : null}
        {timer.status === 'paused' ? (
          <View style={{ alignItems: 'center' }}>
            <SceneTextButton
              label="Descartar esta leitura"
              icon="delete-outline"
              color={readingPalette.nightMuted}
              disabled={busy}
              onPress={onDiscard}
            />
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          {timer.status === 'idle' ? (
            <SceneButton
              variant="gold"
              label="Começar a ler"
              icon="play-arrow"
              accessibilityLabel="Começar a ler"
              disabled={busy}
              style={{ flex: 1 }}
              onPress={() => void timer.start().catch(() => undefined)}
            />
          ) : (
            <>
              <SceneButton
                variant="glass"
                label={running ? 'Pausar' : 'Retomar'}
                icon={running ? 'pause' : 'play-arrow'}
                disabled={busy || (!running && timer.reachedCap)}
                style={{ width: Math.min(132, width * 0.34) }}
                onPress={() =>
                  void (running ? timer.pause() : timer.start()).catch(() => undefined)
                }
              />
              <SceneButton
                variant="gold"
                label="Terminei por hoje"
                accessibilityLabel="Terminei por hoje: informar a página e lembrar"
                accessibilityHint={
                  canFinish ? undefined : 'Disponível a partir de 1 minuto de leitura'
                }
                disabled={!canFinish || busy}
                style={{ flex: 1 }}
                onPress={() => void openSheet()}
              />
            </>
          )}
        </View>
      </View>

      <PageSheet
        visible={sheet}
        tone="night"
        startPage={entry.currentPage}
        totalPages={entry.book.totalPages}
        initialValue={draft.page}
        confirmLabel="Agora, lembrar sem espiar"
        busy={sheetBusy}
        error={error}
        onClose={closeSheet}
        onConfirm={(page) => void confirmPage(page)}
      />
    </View>
  );
}

/** The ribbon bookmark hanging from the book; its swallowtail end moves down with the session. */
function Ribbon({
  bookWidth,
  progress,
  swaying,
}: {
  bookWidth: number;
  progress: number;
  swaying: boolean;
}) {
  const ribbonWidth = Math.round(bookWidth * 0.13);
  const shortest = Math.round(bookWidth * 0.26);
  const longest = Math.round(bookWidth * 1.86);
  const notch = Math.max(6, Math.round(ribbonWidth * 0.45));
  const visible = shortest + (longest - shortest) * progress;
  const offset = useMotionValue(visible - longest, 900);
  const sway = useAmbientLoop(4200, swaying, 0.5);
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-1.2deg', '1.2deg'] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: Math.round(bookWidth * 0.67),
        top: -4,
        width: ribbonWidth,
        height: longest,
        overflow: 'hidden',
        transformOrigin: 'top',
        transform: [{ rotate }],
      }}
    >
      <Animated.View style={{ height: longest, transform: [{ translateY: offset }] }}>
        <View style={{ flex: 1, backgroundColor: readingPalette.ribbon }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: Math.round(ribbonWidth * 0.25),
              backgroundColor: readingPalette.ribbonShade,
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', height: notch }}>
          <View
            style={{
              width: 0,
              height: 0,
              borderTopWidth: notch,
              borderTopColor: readingPalette.ribbon,
              borderRightWidth: ribbonWidth / 2,
              borderRightColor: readingPalette.transparent,
            }}
          />
          <View
            style={{
              width: 0,
              height: 0,
              borderTopWidth: notch,
              borderTopColor: readingPalette.ribbon,
              borderLeftWidth: ribbonWidth / 2,
              borderLeftColor: readingPalette.transparent,
            }}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function Leaf({
  width,
  state,
  pulsing,
}: {
  width: number;
  state: 'done' | 'now' | 'ahead';
  pulsing: boolean;
}) {
  const pulse = useAmbientLoop(1200, pulsing && state === 'now', 1);
  return (
    <Animated.View
      style={{
        width,
        height: 22,
        borderTopLeftRadius: 3,
        borderBottomLeftRadius: 3,
        borderTopRightRadius: 6,
        borderBottomRightRadius: 6,
        backgroundColor:
          state === 'done'
            ? readingPalette.gold
            : state === 'now'
              ? readingPalette.leafNow
              : readingPalette.leafAhead,
        opacity:
          state === 'now' ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) : 1,
      }}
    />
  );
}
