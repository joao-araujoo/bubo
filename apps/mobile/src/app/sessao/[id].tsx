import { type ReadingSession, type ShelfEntry } from '@bubo/contracts';
import {
  MIN_SESSION_SECONDS,
  focusElapsedMs,
  newReadingGoal,
  pauseFocusClock,
  sessionTargetMinutes,
} from '@bubo/domain';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import { Button, EmptyState, FormScreen, InlineMessage, Text } from '../../design-system';
import {
  clearSessionDraft,
  createSessionDraftPersistence,
  readSessionDraft,
  writeSessionDraft,
  type SessionDraft,
  type SessionDraftUpdate,
} from '../../features/session/draft-storage';
import { TimerStep } from '../../features/session/NightTimer';
import { RecallStep, type SavedSession } from '../../features/session/RecallCard';
import { ReceiptStep } from '../../features/session/Receipt';
import { formatDuration } from '../../features/session/useFocusTimer';
import { ApiError } from '../../lib/api/client';
import { usePreferences, useShelf, useShelfEntry, useStats } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

/** Focused reading session: night timer → recall card → server acceptance → receipt (ADR-044). */
export default function ReadingSessionScreen() {
  const theme = useTheme();
  const { id, goal } = useLocalSearchParams<{ id: string; goal?: string }>();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const entryId = typeof id === 'string' ? id : '';
  const detail = useShelfEntry(userId, entryId);
  const shelf = useShelf(userId);
  const retryableError = detail.error instanceof ApiError && detail.error.retryable;
  const canUseShelfCache =
    !shelf.isError || (shelf.error instanceof ApiError && shelf.error.retryable);
  const cachedEntry = canUseShelfCache
    ? shelf.data?.entries.find((item) => item.id === entryId)
    : undefined;
  const canUseReadingData = !detail.isError || retryableError;
  const entry = canUseReadingData ? (detail.data?.entry ?? cachedEntry) : undefined;
  if (!userId || (detail.isPending && !entry)) {
    return (
      <FormScreen>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando livro" />
      </FormScreen>
    );
  }
  if (detail.isError && detail.error instanceof ApiError && detail.error.code === 'NOT_FOUND')
    return <MissingSessionBook key={`${userId}:${entryId}`} userId={userId} entryId={entryId} />;
  if (!entry) {
    return (
      <FormScreen>
        <EmptyState
          mascot="error"
          title="Não foi possível abrir o livro"
          description={
            retryableError
              ? 'Tente novamente quando a conexão voltar. Sua sessão guardada continua neste aparelho.'
              : 'Não foi possível acessar este livro agora. Sua sessão guardada continua neste aparelho.'
          }
        />
        <Button
          label="Tentar novamente"
          onPress={() => void Promise.all([detail.refetch(), shelf.refetch()])}
        />
      </FormScreen>
    );
  }

  return (
    <DurableSession
      key={`${userId}:${entry.id}`}
      userId={userId}
      entry={entry}
      sessions={detail.data?.sessions ?? []}
      historyState={detail.data ? 'ready' : detail.isPending ? 'loading' : 'unavailable'}
      goal={goal}
    />
  );
}

function MissingSessionBook({ userId, entryId }: { userId: string; entryId: string }) {
  const router = useRouter();
  const [stored, setStored] = useState<SessionDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    readSessionDraft(userId)
      .then((draft) => {
        if (!active) return;
        setStored(draft?.shelfEntryId === entryId ? draft : null);
        setError(null);
      })
      .catch(() => {
        if (active) setError('Não foi possível recuperar o registro local. Tente novamente.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, entryId, attempt]);

  function discardMissingDraft() {
    if (!stored || busy) return;
    const expectedId = stored.id;
    Alert.alert(
      'Descartar registro local?',
      'O tempo ainda não salvo será perdido. Isso descarta apenas este registro do aparelho.',
      [
        { text: 'Manter', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void clearSessionDraft(userId, expectedId)
              .then(() => {
                haptics.selection();
                router.replace('/');
              })
              .catch(() =>
                setError('Não foi possível descartar o registro local. Tente novamente.'),
              )
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }

  return (
    <FormScreen title="Sua leitura">
      <EmptyState
        mascot="error"
        title="Livro não encontrado"
        description="Ele pode ter sido removido da sua estante."
      />
      {loading ? <ActivityIndicator accessibilityLabel="Recuperando registro local" /> : null}
      {error ? (
        <>
          <InlineMessage tone="error" message={error} />
          <Button
            label="Tentar recuperar registro"
            variant="secondary"
            disabled={busy || loading}
            onPress={() => {
              setLoading(true);
              setAttempt((current) => current + 1);
            }}
          />
        </>
      ) : null}
      {stored ? (
        <>
          <Text variant="bodySm" color="textMuted">
            Há uma sessão deste livro guardada neste aparelho. Você pode descartar apenas esse
            registro local.
          </Text>
          <Button
            label="Descartar registro local"
            icon="delete-outline"
            variant="secondary"
            loading={busy}
            disabled={loading}
            onPress={discardMissingDraft}
          />
        </>
      ) : null}
    </FormScreen>
  );
}

function DurableSession({
  userId,
  entry,
  sessions,
  historyState,
  goal,
}: {
  userId: string;
  entry: ShelfEntry;
  sessions: readonly ReadingSession[];
  historyState: 'ready' | 'loading' | 'unavailable';
  goal: string | undefined;
}) {
  const theme = useTheme();
  const router = useRouter();
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [recover, setRecover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const stats = useStats(userId);
  const preferences = usePreferences(userId);
  const pendingWrites = useRef(0);
  const initialPage = useRef(String(entry.currentPage));
  const initialGoal = useRef(newReadingGoal(goal));
  const persistence = useRef<ReturnType<typeof createSessionDraftPersistence> | null>(null);

  function fresh(): SessionDraft {
    return {
      version: 1,
      id: Crypto.randomUUID(),
      shelfEntryId: entry.id,
      startedAt: null,
      accumulatedMs: 0,
      runningSince: null,
      endedAt: null,
      page: String(entry.currentPage),
      reflection: '',
      ...initialGoal.current,
      submission: null,
    };
  }

  useEffect(() => {
    let active = true;
    readSessionDraft(userId)
      .then(async (stored) => {
        if (!active) return;
        if (stored?.runningSince !== null && stored) {
          stored = { ...stored, ...pauseFocusClock(stored, Date.now()) };
          await writeSessionDraft(userId, stored);
        }
        if (!active) return;
        const recovered = stored ?? {
          version: 1,
          id: Crypto.randomUUID(),
          shelfEntryId: entry.id,
          startedAt: null,
          accumulatedMs: 0,
          runningSince: null,
          endedAt: null,
          page: initialPage.current,
          reflection: '',
          ...initialGoal.current,
          submission: null,
        };
        persistence.current = createSessionDraftPersistence(userId, recovered, setDraft);
        setDraft(recovered);
        setRecover(stored !== null);
        setLoaded(true);
      })
      .catch(() => {
        if (active) {
          setError('Não foi possível recuperar a sessão neste aparelho.');
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [userId, entry.id]);

  async function persist(update: SessionDraftUpdate) {
    pendingWrites.current += 1;
    setBusy(true);
    try {
      if (!persistence.current) throw new Error('Session draft unavailable');
      await persistence.current.persist(update);
      setError(null);
    } catch (e) {
      setError('Não foi possível guardar a sessão neste aparelho. Tente novamente.');
      throw e;
    } finally {
      pendingWrites.current -= 1;
      setBusy(pendingWrites.current > 0);
    }
  }

  function discard() {
    Alert.alert(
      'Descartar registro local?',
      'O tempo ainda não salvo será perdido. Sessões já salvas continuam no histórico.',
      [
        { text: 'Manter', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            const next = fresh();
            const removal = persistence.current
              ? persistence.current.discard(next)
              : clearSessionDraft(userId).then(() => {
                  persistence.current = createSessionDraftPersistence(userId, next, setDraft);
                  setDraft(next);
                });
            void removal
              .then(() => {
                setRecover(false);
                setError(null);
              })
              .catch(() => setError('Não foi possível descartar. Tente novamente.'))
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }

  if (saved)
    return (
      <ReceiptStep
        result={saved.result}
        cleanupWarning={saved.cleanupWarning}
        coach={saved.coach}
        celebrateStreak={saved.streakGrew}
      />
    );
  if (!loaded)
    return (
      <FormScreen title="Sua leitura">
        <ActivityIndicator accessibilityLabel="Recuperando sessão" />
      </FormScreen>
    );
  if (!draft)
    return (
      <FormScreen title="Sua leitura">
        <InlineMessage tone="error" message={error ?? 'Sessão indisponível.'} />
        <Button label="Descartar registro local" onPress={discard} disabled={busy} />
      </FormScreen>
    );
  if (recover) {
    const sameBook = draft.shelfEntryId === entry.id;
    return (
      <FormScreen title="Você tinha uma leitura em andamento">
        <Text>
          Seu registro ficou guardado neste aparelho.{' '}
          {draft.endedAt
            ? 'Falta conferir sua recordação e salvar a sessão.'
            : 'Você pode continuar ou encerrar.'}
        </Text>
        <Text variant="titleSm">{formatDuration(focusElapsedMs(draft, Date.now()) / 1000)}</Text>
        {draft.startedAt !== null && Date.now() - draft.startedAt > 48 * 60 * 60 * 1000 ? (
          <InlineMessage
            tone="info"
            message="O prazo de 48 horas para salvar esta sessão passou. Sua anotação continua aqui; envios já salvos podem ser confirmados novamente."
          />
        ) : null}
        {error ? <InlineMessage tone="error" message={error} /> : null}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            label="Descartar"
            icon="delete-outline"
            variant="secondary"
            iconOnly
            disabled={busy}
            onPress={discard}
          />
          <Button
            label={sameBook ? 'Continuar' : 'Abrir leitura'}
            accessibilityLabel={sameBook ? 'Continuar' : 'Abrir a leitura em andamento'}
            icon={sameBook ? 'play-arrow' : 'menu-book'}
            compact
            style={{ flex: 1 }}
            disabled={busy}
            onPress={() => {
              if (!sameBook) {
                router.replace({ pathname: '/sessao/[id]', params: { id: draft.shelfEntryId } });
                return;
              }
              // Stop counting while the reader decides; resuming is always explicit.
              void persist({ ...draft, ...pauseFocusClock(draft, Date.now()) })
                .then(() => setRecover(false))
                .catch(() => undefined);
            }}
          />
          {sameBook && !draft.endedAt ? (
            <Button
              label="Encerrar"
              icon="flag"
              variant="success"
              compact
              style={{ flex: 1 }}
              disabled={busy || focusElapsedMs(draft, Date.now()) < MIN_SESSION_SECONDS * 1000}
              onPress={() => {
                const stamp = Date.now();
                void persist({ ...draft, ...pauseFocusClock(draft, stamp), endedAt: stamp })
                  .then(() => setRecover(false))
                  .catch(() => undefined);
              }}
            />
          ) : null}
        </View>
      </FormScreen>
    );
  }
  if (draft.endedAt !== null)
    return (
      <RecallStep
        entry={entry}
        userId={userId}
        draft={draft}
        persist={persist}
        onDiscard={discard}
        onSaved={setSaved}
        streakBefore={stats.data?.streakDays ?? null}
      />
    );
  return (
    <TimerStep
      key={draft.id}
      entry={entry}
      sessions={sessions}
      historyState={historyState}
      draft={draft}
      persist={persist}
      busy={busy}
      error={error}
      onDiscard={discard}
      targetMinutes={sessionTargetMinutes({
        goalSeconds: draft.goalSeconds,
        dailyGoalMinutes: preferences.data?.dailyFocusMinutes ?? null,
        focusedMinutesToday: stats.data?.focusedMinutesToday ?? null,
      })}
      streakDays={stats.data?.streakDays ?? null}
    />
  );
}
