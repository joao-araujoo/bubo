import { type SessionResult, type ShelfEntry } from '@bubo/contracts';
import {
  MAX_REFLECTION_LENGTH,
  MIN_SESSION_SECONDS,
  focusElapsedMs,
  pauseFocusClock,
  toLocalIsoDate,
} from '@bubo/domain';
import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

import {
  BookCover,
  BuboMascot,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  InlineMessage,
  Text,
  TextField,
} from '../../design-system';
import { formatDuration, useFocusTimer } from '../../features/session/useFocusTimer';
import {
  clearSessionDraft,
  readSessionDraft,
  writeSessionDraft,
  type SessionDraft,
} from '../../features/session/draft-storage';
import { ApiError } from '../../lib/api/client';
import { useRecordSession, useShelfEntry } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

/** Leaving keeps the durable draft, including its running/paused state. */
function useConfirmLeave(active: boolean) {
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!active) return;
        event.preventDefault();
        Alert.alert(
          'Sair da leitura?',
          'Sua sessão fica guardada neste aparelho para continuar depois.',
          [
            { text: 'Continuar', style: 'cancel' },
            {
              text: 'Sair e guardar',
              onPress: () => navigation.dispatch(event.data.action),
            },
          ],
        );
      }),
    [navigation, active],
  );
}

function TimerStep({
  entry,
  draft,
  persist,
  busy,
  error,
  onDiscard,
}: {
  entry: ShelfEntry;
  draft: SessionDraft;
  persist: (draft: SessionDraft) => Promise<void>;
  busy: boolean;
  error: string | null;
  onDiscard: () => void;
}) {
  const theme = useTheme();
  const timer = useFocusTimer(draft, persist);
  const canFinish = timer.elapsedSeconds >= MIN_SESSION_SECONDS;
  const active = timer.status !== 'idle';
  useConfirmLeave(active);

  return (
    <FormScreen
      footer={
        <>
          {error ? <InlineMessage tone="error" message={error} /> : null}
          {timer.status === 'running' ? (
            <Button
              label="Pausar"
              icon="pause"
              variant="secondary"
              fullWidth
              disabled={busy}
              onPress={() => void timer.pause().catch(() => undefined)}
            />
          ) : (
            <Button
              label={timer.status === 'idle' ? 'Começar a ler' : 'Retomar'}
              icon="play-arrow"
              fullWidth
              disabled={timer.reachedCap || busy}
              onPress={() => void timer.start().catch(() => undefined)}
            />
          )}
          <Button
            label="Encerrar sessão"
            icon="flag"
            variant="success"
            fullWidth
            disabled={!canFinish || busy}
            accessibilityHint={canFinish ? undefined : 'Disponível a partir de 1 minuto de leitura'}
            onPress={() => {
              haptics.commit();
              void timer.finish().catch(() => undefined);
            }}
          />
          <Button
            label="Descartar sessão"
            variant="secondary"
            size="md"
            disabled={busy}
            onPress={onDiscard}
          />
        </>
      }
    >
      <Chip label="Modo leitura profunda" eyebrow align="center" />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BookCover
          title={entry.book.title}
          author={entry.book.author}
          coverUrls={entry.book.coverUrls}
          width={52}
        />
        <View style={{ flex: 1 }}>
          <Text variant="titleSm" numberOfLines={2}>
            {entry.book.title}
          </Text>
          {entry.book.author ? (
            <Text variant="bodySm" color="textMuted">
              {entry.book.author}
            </Text>
          ) : null}
          <Text variant="bodySm" color="accentText">
            Pág. {entry.currentPage}
          </Text>
        </View>
      </Card>
      <View
        style={{ alignItems: 'center', gap: theme.spacing.md, marginVertical: theme.spacing.xl }}
      >
        <View
          style={{
            width: 248,
            height: 248,
            borderRadius: theme.radii.pill,
            borderWidth: 9,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <BuboMascot state="focusSession" size={118} />
          <Text
            variant="heading"
            align="center"
            accessibilityRole="timer"
            accessibilityLabel={`Tempo focado: ${formatDuration(timer.elapsedSeconds)}`}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatDuration(timer.elapsedSeconds)}
          </Text>
        </View>
        <Text variant="bodySm" color="textMuted" align="center">
          {timer.status === 'idle'
            ? 'Quando estiver pronto, comece. Deixe o celular de lado e leia com atenção total.'
            : timer.status === 'running'
              ? 'Lendo… a tela fica acesa enquanto o tempo corre.'
              : timer.reachedCap
                ? 'Você chegou ao limite de 4 horas por sessão. Encerre para salvar.'
                : 'Pausado. Retome quando voltar ao livro.'}
        </Text>
      </View>
      {active && !canFinish ? (
        <InlineMessage
          tone="info"
          message="Sessões contam a partir de 1 minuto de leitura focada."
        />
      ) : null}
    </FormScreen>
  );
}

function FinishStep({
  entry,
  userId,
  draft,
  persist,
  onDiscard,
  onSaved,
}: {
  entry: ShelfEntry;
  userId: string;
  draft: SessionDraft;
  persist: (draft: SessionDraft) => Promise<void>;
  onDiscard: () => void;
  onSaved: (result: SessionResult) => void;
}) {
  const theme = useTheme();
  const save = useRecordSession(userId);
  useConfirmLeave(!save.isSuccess);
  const total = entry.book.totalPages;
  const [page, setPage] = useState(draft.page);
  const [reflection, setReflection] = useState(draft.reflection);
  const [pageError, setPageError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const submitting = useRef(false);
  const [sending, setSending] = useState(false);

  async function submit() {
    if (submitting.current) return;
    const endPage = Number(page.trim());
    if (
      !draft.submission &&
      (!/^\d+$/.test(page.trim()) ||
        endPage < entry.currentPage ||
        (total !== null && endPage > total))
    ) {
      setPageError(
        total !== null
          ? `Informe uma página entre ${entry.currentPage} e ${total}.`
          : `Informe uma página a partir de ${entry.currentPage}.`,
      );
      haptics.warning();
      return;
    }
    setPageError(null);
    submitting.current = true;
    setSending(true);
    try {
      const submission = draft.submission ?? {
        id: draft.id,
        shelfEntryId: entry.id,
        startedAt: new Date(draft.startedAt ?? 0).toISOString(),
        endedAt: new Date(draft.endedAt ?? 0).toISOString(),
        focusedSeconds: Math.floor(draft.accumulatedMs / 1000),
        endPage,
        reflection: reflection.trim() === '' ? null : reflection.trim(),
        localDate: toLocalIsoDate(new Date(draft.endedAt ?? 0)),
      };
      await persist({ ...draft, page, reflection, submission });
      const result = await save.mutateAsync(submission);
      await clearSessionDraft(userId);
      haptics.success();
      onSaved(result);
    } catch (error) {
      haptics.error();
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
        await persist({ ...draft, page, reflection, submission: null }).catch(() => undefined);
      }
      setLocalError('Não foi possível concluir. O registro foi mantido para tentar novamente.');
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }

  const errorMessage =
    save.error instanceof ApiError &&
    (save.error.code === 'NETWORK_ERROR' || save.error.code === 'TIMEOUT')
      ? 'Sem conexão. Sua sessão continua aqui — tente salvar de novo.'
      : 'Não foi possível salvar a sessão. Tente de novo.';

  return (
    <FormScreen
      back={false}
      footer={
        <>
          <Button label="Salvar sessão" icon="check" fullWidth loading={sending} onPress={submit} />
          <Button
            label="Descartar registro local"
            variant="secondary"
            disabled={sending}
            onPress={onDiscard}
          />
        </>
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading" accessibilityRole="header">
          Boa leitura!
        </Text>
        <Text variant="body" color="textMuted">
          Você leu com foco por {formatDuration(draft.accumulatedMs / 1000)}. Registre até onde
          chegou.
        </Text>
      </View>
      {save.isError ? <InlineMessage tone="error" message={errorMessage} /> : null}
      {localError ? <InlineMessage tone="error" message={localError} /> : null}
      {draft.submission ? (
        <InlineMessage
          tone="info"
          message="Este envio está guardado. Tentar novamente usa os mesmos dados para evitar duplicações."
        />
      ) : null}
      <TextField
        label="Até que página você chegou?"
        icon="bookmark-border"
        keyboardType="number-pad"
        value={page}
        editable={!draft.submission && !sending}
        onChangeText={(value) => {
          setPage(value);
          void persist({ ...draft, page: value.slice(0, 10), reflection }).catch(() =>
            setLocalError('Não foi possível guardar o rascunho neste aparelho.'),
          );
        }}
        error={pageError}
        hint={
          total !== null ? `Você estava na página ${entry.currentPage} de ${total}.` : undefined
        }
      />
      <TextField
        label="O que ficou com você? (opcional)"
        icon="edit-note"
        placeholder="Uma ideia, uma frase, uma pergunta…"
        value={reflection}
        editable={!draft.submission && !sending}
        onChangeText={(value) => {
          const text = value.slice(0, MAX_REFLECTION_LENGTH);
          setReflection(text);
          void persist({ ...draft, page, reflection: text }).catch(() =>
            setLocalError('Não foi possível guardar o rascunho neste aparelho.'),
          );
        }}
        multiline
        textAlignVertical="top"
        hint="Explicar com suas palavras ajuda a lembrar depois."
      />
    </FormScreen>
  );
}

function ResultStep({ result }: { result: SessionResult }) {
  const theme = useTheme();
  const router = useRouter();
  const minutes = Math.floor(result.session.focusedSeconds / 60);
  const finishedBook = result.entry.status === 'finished';
  const stats = [
    { label: 'minutos focados', value: String(minutes) },
    {
      label: result.session.pagesRead === 1 ? 'página lida' : 'páginas lidas',
      value: String(result.session.pagesRead),
    },
    { label: 'XP ganho', value: `+${result.xpEarned}` },
  ];

  return (
    <FormScreen
      back={false}
      footer={
        <Button
          label="Voltar para Hoje"
          icon="home"
          fullWidth
          onPress={() => router.dismissTo('/')}
        />
      }
    >
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <BuboMascot state={finishedBook ? 'achievementUnlocked' : 'sessionComplete'} size={180} />
        <Chip
          label={
            result.stats.streakDays > 1
              ? `${result.stats.streakDays} dias seguidos`
              : 'Primeiro dia da sequência'
          }
          tone="orange"
          icon="local-fire-department"
          iconColor="orange"
          align="center"
        />
        <Text variant="display" align="center" accessibilityRole="header">
          {finishedBook ? 'Livro concluído!' : 'Essa leitura ficou.'}
        </Text>
        <Text variant="bodyLg" color="textMuted" align="center">
          {finishedBook
            ? `Você terminou ${result.entry.book.title}. Que jornada!`
            : 'Cada sessão focada fortalece o que você vai lembrar amanhã.'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {stats.map((item) => (
          <Card
            key={item.label}
            containerStyle={{ flex: 1 }}
            style={{ alignItems: 'center', padding: theme.spacing.md }}
          >
            <Text variant="heading" align="center">
              {item.value}
            </Text>
            <Text variant="bodySm" color="textMuted" align="center">
              {item.label}
            </Text>
          </Card>
        ))}
      </View>
    </FormScreen>
  );
}

/** Focused reading session: timer → pages + reflection → result ("Essa leitura ficou"). */
export default function ReadingSessionScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const detail = useShelfEntry(userId, typeof id === 'string' ? id : '');
  if (detail.isPending || !userId) {
    return (
      <FormScreen>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando livro" />
      </FormScreen>
    );
  }
  if (detail.isError) {
    return (
      <FormScreen>
        <EmptyState
          mascot="error"
          title="Livro não encontrado"
          description="Ele pode ter sido removido da sua estante."
        />
      </FormScreen>
    );
  }

  return (
    <DurableSession
      key={`${userId}:${detail.data.entry.id}`}
      userId={userId}
      entry={detail.data.entry}
    />
  );
}

function DurableSession({ userId, entry }: { userId: string; entry: ShelfEntry }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [recover, setRecover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const pendingWrites = useRef(0);

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
        setDraft(
          stored ?? {
            version: 1,
            id: Crypto.randomUUID(),
            shelfEntryId: entry.id,
            startedAt: null,
            accumulatedMs: 0,
            runningSince: null,
            endedAt: null,
            page: String(entry.currentPage),
            reflection: '',
            submission: null,
          },
        );
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
  }, [userId, entry.id, entry.currentPage]);

  async function persist(next: SessionDraft) {
    pendingWrites.current += 1;
    setBusy(true);
    try {
      await writeSessionDraft(userId, next);
      setDraft(next);
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
      'O tempo não enviado será perdido. Uma sessão já recebida pela API continua no histórico.',
      [
        { text: 'Manter', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void clearSessionDraft(userId)
              .then(() => {
                setDraft(fresh());
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

  if (result) return <ResultStep result={result} />;
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
            ? 'Falta salvar a página e a reflexão.'
            : 'Você pode continuar ou encerrar.'}
        </Text>
        <Text variant="titleSm">{formatDuration(focusElapsedMs(draft, Date.now()) / 1000)}</Text>
        {draft.startedAt !== null && Date.now() - draft.startedAt > 48 * 60 * 60 * 1000 ? (
          <InlineMessage
            tone="info"
            message="Este registro tem mais de 48 horas. A API só aceita novas sessões dentro desse prazo. Você pode consultar sua reflexão; um envio já recebido pode ser confirmado novamente."
          />
        ) : null}
        {error ? <InlineMessage tone="error" message={error} /> : null}
        <Button
          label={sameBook ? 'Continuar' : 'Abrir a leitura em andamento'}
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
            variant="success"
            disabled={busy || focusElapsedMs(draft, Date.now()) < MIN_SESSION_SECONDS * 1000}
            onPress={() => {
              const stamp = Date.now();
              void persist({ ...draft, ...pauseFocusClock(draft, stamp), endedAt: stamp })
                .then(() => setRecover(false))
                .catch(() => undefined);
            }}
          />
        ) : null}
        <Button label="Descartar" variant="secondary" disabled={busy} onPress={discard} />
      </FormScreen>
    );
  }
  if (draft.endedAt !== null)
    return (
      <FinishStep
        entry={entry}
        userId={userId}
        draft={draft}
        persist={persist}
        onDiscard={discard}
        onSaved={setResult}
      />
    );
  return (
    <TimerStep
      entry={entry}
      draft={draft}
      persist={persist}
      busy={busy}
      error={error}
      onDiscard={discard}
    />
  );
}
