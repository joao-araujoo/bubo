import {
  SESSION_RECALL_FIELD_MAX_LENGTH,
  type AssessSessionResponse,
  type SessionRecall,
  type SessionResult,
  type ShelfEntry,
  type ReadingSession,
} from '@bubo/contracts';
import {
  MIN_SESSION_SECONDS,
  focusElapsedMs,
  newReadingGoal,
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
  Toggle,
} from '../../design-system';
import { formatDuration, useFocusTimer } from '../../features/session/useFocusTimer';
import { BeforeReadingCard } from '../../features/session/BeforeReadingCard';
import {
  clearSessionDraft,
  createSessionDraftPersistence,
  readSessionDraft,
  writeSessionDraft,
  type SessionDraft,
  type SessionDraftPersist,
  type SessionDraftUpdate,
} from '../../features/session/draft-storage';
import { ApiError } from '../../lib/api/client';
import { useAssessSession, useRecordSession, useShelf, useShelfEntry } from '../../lib/api/queries';
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
  sessions,
  historyState,
  draft,
  persist,
  busy,
  error,
  onDiscard,
}: {
  entry: ShelfEntry;
  sessions: readonly ReadingSession[];
  historyState: 'ready' | 'loading' | 'unavailable';
  draft: SessionDraft;
  persist: SessionDraftPersist;
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
          {/* One row: discard (icon), play/pause and finish, so the timer keeps the screen. */}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              label="Descartar sessão"
              icon="delete-outline"
              variant="secondary"
              iconOnly
              disabled={busy}
              onPress={onDiscard}
            />
            {timer.status === 'running' ? (
              <Button
                label="Pausar"
                icon="pause"
                variant="secondary"
                compact
                style={{ flex: 1 }}
                disabled={busy}
                onPress={() => void timer.pause().catch(() => undefined)}
              />
            ) : (
              <Button
                label={timer.status === 'idle' ? 'Começar' : 'Retomar'}
                accessibilityLabel={timer.status === 'idle' ? 'Começar a ler' : 'Retomar'}
                icon="play-arrow"
                compact
                style={{ flex: 1 }}
                disabled={timer.reachedCap || busy}
                onPress={() => void timer.start().catch(() => undefined)}
              />
            )}
            <Button
              label="Recordação"
              accessibilityLabel="Ir para a recordação"
              icon="flag"
              variant="success"
              compact
              style={{ flex: 1.2 }}
              disabled={!canFinish || busy}
              accessibilityHint={
                canFinish ? undefined : 'Disponível a partir de 1 minuto de leitura'
              }
              onPress={() => {
                haptics.commit();
                void timer.finish().catch(() => undefined);
              }}
            />
          </View>
        </>
      }
    >
      <Chip
        label={draft.goalSeconds === 300 ? 'Só 5 minutos para começar' : 'Modo leitura profunda'}
        eyebrow
        align="center"
      />
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
      {timer.status === 'idle' ? (
        <BeforeReadingCard
          shelfEntryId={entry.id}
          currentPage={entry.currentPage}
          sessions={sessions}
          historyState={historyState}
          busy={busy}
          onStart={() => void timer.start().catch(() => undefined)}
        />
      ) : null}
      {draft.goalNoticeShown ? (
        <InlineMessage
          tone="success"
          message="Você leu por 5 minutos. Pode continuar ou ir para a recordação quando quiser."
        />
      ) : timer.goalNoticeError ? (
        <>
          <InlineMessage
            tone="error"
            message="Não foi possível guardar o aviso da meta neste aparelho. Você pode continuar lendo ou tentar novamente."
          />
          <Button
            label="Tentar guardar aviso"
            variant="secondary"
            size="md"
            disabled={busy}
            onPress={() => void timer.acknowledgeGoal()}
          />
        </>
      ) : null}
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
  persist: SessionDraftPersist;
  onDiscard: () => void;
  onSaved: (result: SessionResult, cleanupWarning?: string) => void;
}) {
  const theme = useTheme();
  const save = useRecordSession(userId);
  const check = useAssessSession();
  useConfirmLeave(!save.isSuccess);
  const total = entry.book.totalPages;
  const [page, setPage] = useState(draft.page);
  const [recall, setRecall] = useState<SessionRecall>(
    draft.submission?.recall ??
      draft.recall ?? {
        idea: draft.reflection.slice(0, SESSION_RECALL_FIELD_MAX_LENGTH),
        detail: '',
        connection: '',
      },
  );
  const [assessment, setAssessment] = useState<AssessSessionResponse | null>(null);
  const [coach, setCoach] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const submitting = useRef(false);
  const [sending, setSending] = useState(false);
  const checking = useRef(false);
  const [evaluating, setEvaluating] = useState(false);
  const editingLocked = Boolean(draft.submission) || sending || evaluating;
  const canSave = Boolean(draft.submission) || assessment?.assessment.passed === true;

  function updateRecall(key: keyof SessionRecall, value: string) {
    if (checking.current || submitting.current || draft.submission) return;
    const next = { ...recall, [key]: value.slice(0, SESSION_RECALL_FIELD_MAX_LENGTH) };
    setRecall(next);
    setAssessment(null);
    setLocalError(null);
    check.reset();
    save.reset();
    void persist({ ...draft, page, recall: next }).catch(() =>
      setLocalError('Não foi possível guardar o rascunho neste aparelho.'),
    );
  }

  async function assess() {
    if (checking.current || submitting.current) return;
    checking.current = true;
    setEvaluating(true);
    setAssessment(null);
    setLocalError(null);
    try {
      await persist({ ...draft, page, recall });
      const response = await check.mutateAsync({ shelfEntryId: entry.id, recall, coach });
      setAssessment(response);
      if (response.assessment.passed) haptics.success();
      else haptics.warning();
    } catch (error) {
      haptics.error();
      setLocalError(
        error instanceof ApiError && (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT')
          ? 'Sem conexão. Sua recordação fica guardada; confira novamente quando voltar.'
          : 'Não foi possível conferir agora. Seu rascunho continua aqui.',
      );
    } finally {
      checking.current = false;
      setEvaluating(false);
    }
  }

  async function submit() {
    if (submitting.current || checking.current || !canSave) return;
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
        reflection: null,
        recall,
        localDate: toLocalIsoDate(new Date(draft.endedAt ?? 0)),
      };
      await persist({ ...draft, page, recall, submission });
      const result = await save.mutateAsync(submission);
      let cleanupWarning: string | undefined;
      try {
        await clearSessionDraft(userId, draft.id);
      } catch {
        cleanupWarning =
          'A sessão foi salva, mas não foi possível apagar o rascunho deste aparelho. Se ele reaparecer, confirme o mesmo envio: não contará duas vezes.';
      }
      haptics.success();
      onSaved(result, cleanupWarning);
    } catch (error) {
      haptics.error();
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
        setAssessment(null);
        await persist({ ...draft, page, recall, submission: null }).catch(() => undefined);
        setLocalError(
          'Confira a página e os três campos de recordação antes de tentar concluir novamente.',
        );
      } else {
        setLocalError('Não foi possível concluir. O registro foi mantido para tentar novamente.');
      }
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
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            label="Descartar registro local"
            icon="delete-outline"
            variant="secondary"
            iconOnly
            disabled={sending || evaluating}
            onPress={() => {
              if (!checking.current && !submitting.current) onDiscard();
            }}
          />
          {!draft.submission ? (
            <Button
              label={assessment ? 'Reconferir' : 'Conferir'}
              accessibilityLabel={assessment ? 'Conferir novamente' : 'Conferir minha recordação'}
              icon="fact-check"
              variant="secondary"
              compact
              style={{ flex: 1 }}
              loading={evaluating}
              disabled={sending}
              onPress={() => void assess()}
            />
          ) : null}
          <Button
            label={draft.submission ? 'Confirmar envio' : 'Salvar sessão'}
            accessibilityLabel={
              draft.submission ? 'Confirmar envio guardado' : 'Concluir e salvar sessão'
            }
            icon="check"
            compact
            style={{ flex: 1.2 }}
            loading={sending}
            disabled={!canSave || evaluating}
            accessibilityHint={canSave ? undefined : 'Complete e confira a recordação primeiro'}
            onPress={() => void submit()}
          />
        </View>
      }
    >
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading" accessibilityRole="header">
          Feche o livro. Abra a memória.
        </Text>
        <Text variant="body" color="textMuted">
          Você leu com foco por {formatDuration(draft.accumulatedMs / 1000)}. Antes de concluir,
          responda sem consultar o livro.
        </Text>
      </View>
      {save.isError ? <InlineMessage tone="error" message={errorMessage} /> : null}
      {localError ? <InlineMessage tone="error" message={localError} /> : null}
      {draft.submission ? (
        <InlineMessage
          tone="info"
          message="Envio guardado. Tente novamente para confirmar a sessão."
        />
      ) : null}
      {draft.reflection ? (
        <Card style={{ gap: theme.spacing.xs }}>
          <Text variant="titleSm">Sua anotação anterior</Text>
          <Text variant="bodySm">{draft.reflection}</Text>
          <Text variant="bodySm" color="textMuted">
            Organize sua anotação nos três campos abaixo.
          </Text>
        </Card>
      ) : null}
      <TextField
        label="Até que página você chegou?"
        icon="bookmark-border"
        keyboardType="number-pad"
        value={page}
        editable={!editingLocked}
        onChangeText={(value) => {
          if (checking.current || submitting.current || draft.submission) return;
          setPage(value.slice(0, 10));
          setPageError(null);
          void persist({ ...draft, page: value.slice(0, 10), recall }).catch(() =>
            setLocalError('Não foi possível guardar o rascunho neste aparelho.'),
          );
        }}
        error={pageError}
        hint={
          total !== null ? `Você estava na página ${entry.currentPage} de ${total}.` : undefined
        }
      />
      <TextField
        label="1. Qual ideia, cena ou imagem ficou?"
        icon="edit-note"
        placeholder="Conte com suas palavras o que você lembra."
        value={recall.idea}
        editable={!editingLocked}
        onChangeText={(value) => updateRecall('idea', value)}
        maxLength={SESSION_RECALL_FIELD_MAX_LENGTH}
        multiline
        textAlignVertical="top"
      />
      <TextField
        label="2. Que detalhe ajuda a lembrar disso?"
        icon="search"
        placeholder="Uma ação, um exemplo, um argumento ou uma imagem."
        value={recall.detail}
        editable={!editingLocked}
        onChangeText={(value) => updateRecall('detail', value)}
        maxLength={SESSION_RECALL_FIELD_MAX_LENGTH}
        multiline
        textAlignVertical="top"
        hint="Escolha algo concreto diferente da primeira resposta."
      />
      <TextField
        label="3. Que ligação ou dúvida surgiu?"
        icon="psychology"
        placeholder="O que isso explica, lembra ou faz você perguntar?"
        value={recall.connection}
        editable={!editingLocked}
        onChangeText={(value) => updateRecall('connection', value)}
        maxLength={SESSION_RECALL_FIELD_MAX_LENGTH}
        multiline
        textAlignVertical="top"
      />
      {!draft.submission ? (
        <Card>
          <Toggle
            title="Pergunta extra com IA"
            description="Opcional: envia somente estas respostas ao Gemini. Conforme o serviço configurado, o provedor pode usar o texto para melhorar seus modelos. Evite informações pessoais ou sensíveis."
            value={coach}
            onValueChange={
              sending || evaluating
                ? undefined
                : (value) => {
                    if (!checking.current && !submitting.current) setCoach(value);
                  }
            }
          />
        </Card>
      ) : null}
      {assessment ? (
        <Card style={{ gap: theme.spacing.sm }}>
          <Text variant="titleSm" accessibilityRole="header">
            {assessment.assessment.passed ? 'Recordação pronta para guardar' : 'Vamos completar?'}
          </Text>
          <Text accessibilityLiveRegion="polite">{assessment.assessment.feedback}</Text>
          {assessment.assessment.checks.map((item) => (
            <InlineMessage
              key={item.key}
              tone={item.passed ? 'success' : 'info'}
              message={item.message}
            />
          ))}
          <Text variant="bodySm" color="textMuted">
            Esta conferência avalia a escrita, não a retenção nem os fatos do livro.
          </Text>
          {assessment.coach.question ? (
            <InlineMessage tone="info" message={`Para pensar: ${assessment.coach.question}`} />
          ) : assessment.coach.status === 'unavailable' ? (
            <InlineMessage
              tone="info"
              message="A pergunta extra não está disponível agora. Sua recordação pode ser concluída normalmente."
            />
          ) : null}
        </Card>
      ) : (
        <InlineMessage
          tone="info"
          message="Preencha os três campos e confira sua recordação antes de salvar."
        />
      )}
    </FormScreen>
  );
}

function ResultStep({
  result,
  cleanupWarning,
}: {
  result: SessionResult;
  cleanupWarning?: string;
}) {
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
      {cleanupWarning ? <InlineMessage tone="info" message={cleanupWarning} /> : null}
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

/** Focused reading session: timer → mandatory recall → server acceptance → result. */
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
  const [result, setResult] = useState<SessionResult | null>(null);
  const [cleanupWarning, setCleanupWarning] = useState<string | undefined>();
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

  if (result) return <ResultStep result={result} cleanupWarning={cleanupWarning} />;
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
      <FinishStep
        entry={entry}
        userId={userId}
        draft={draft}
        persist={persist}
        onDiscard={discard}
        onSaved={(saved, warning) => {
          setCleanupWarning(warning);
          setResult(saved);
        }}
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
    />
  );
}
