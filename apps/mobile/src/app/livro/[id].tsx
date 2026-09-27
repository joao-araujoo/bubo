import {
  type ReadingSession,
  type RecallCard,
  type ShelfEntry,
  RECALL_ANSWER_MAX,
  RECALL_PROMPT_MAX,
} from '@bubo/contracts';
import { MAX_BOOK_PAGES, type ReadingStatus, readingProgress, toLocalIsoDate } from '@bubo/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import {
  BookCover,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  Icon,
  InlineMessage,
  LinkButton,
  ProgressBar,
  SectionHeader,
  Text,
  TextField,
  ToggleChip,
} from '../../design-system';
import { formatDuration } from '../../features/session/useFocusTimer';
import { STATUS_META, STATUS_ORDER, shortDate } from '../../features/shelf/labels';
import { ApiError } from '../../lib/api/client';
import { dueLabel } from '../../features/recall/grades';
import {
  useCreateCard,
  useDeleteCard,
  useDeleteShelfEntry,
  useShelfEntry,
  useUpdateShelfEntry,
} from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

function ProgressEditor({ entry, userId }: { entry: ShelfEntry; userId: string }) {
  const theme = useTheme();
  const update = useUpdateShelfEntry(userId, entry.id);
  const [page, setPage] = useState(String(entry.currentPage));
  const [total, setTotal] = useState(entry.book.totalPages ? String(entry.book.totalPages) : '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaved(false);
    const currentPage = Number(page.trim());
    const totalPages = total.trim() === '' ? null : Number(total.trim());
    if (!/^\d+$/.test(page.trim()) || (total.trim() !== '' && !/^\d+$/.test(total.trim()))) {
      setError('Use apenas números.');
      return;
    }
    if (totalPages !== null && (totalPages < 1 || totalPages > MAX_BOOK_PAGES)) {
      setError(`O total de páginas deve ficar entre 1 e ${MAX_BOOK_PAGES}.`);
      return;
    }
    if (totalPages !== null && currentPage > totalPages) {
      setError('A página atual não pode passar do total de páginas.');
      return;
    }
    setError(null);
    try {
      await update.mutateAsync({
        currentPage,
        ...(totalPages !== entry.book.totalPages ? { totalPages } : {}),
      });
      haptics.success();
      setSaved(true);
    } catch (e) {
      haptics.error();
      setError(
        e instanceof ApiError && e.code === 'VALIDATION_FAILED'
          ? 'Confira os números.'
          : 'Não foi possível salvar agora.',
      );
    }
  }

  return (
    <Card>
      <SectionHeader title="Atualizar progresso" icon="edit" />
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Página atual"
            keyboardType="number-pad"
            value={page}
            onChangeText={setPage}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Total de páginas"
            keyboardType="number-pad"
            value={total}
            onChangeText={setTotal}
            placeholder="—"
          />
        </View>
      </View>
      {error ? <InlineMessage tone="error" message={error} /> : null}
      {saved ? <InlineMessage tone="success" message="Progresso atualizado." /> : null}
      <Button
        label="Salvar progresso"
        variant="secondary"
        size="md"
        icon="check"
        loading={update.isPending}
        onPress={save}
      />
    </Card>
  );
}

function StatusPicker({ entry, userId }: { entry: ShelfEntry; userId: string }) {
  const theme = useTheme();
  const update = useUpdateShelfEntry(userId, entry.id);
  const change = (status: ReadingStatus) => {
    if (status === entry.status || update.isPending) return;
    update.mutate(
      { status },
      { onSuccess: () => haptics.success(), onError: () => haptics.error() },
    );
  };
  return (
    <Card>
      <SectionHeader title="Status" icon="flag" />
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}
      >
        {STATUS_ORDER.map((status) => (
          <ToggleChip
            key={status}
            label={STATUS_META[status].label}
            icon={STATUS_META[status].icon}
            selected={entry.status === status}
            onPress={() => change(status)}
          />
        ))}
      </View>
      {update.isError ? (
        <InlineMessage tone="error" message="Não foi possível mudar o status agora." />
      ) : null}
    </Card>
  );
}

function SessionHistory({ sessions }: { sessions: ReadingSession[] }) {
  const theme = useTheme();
  return (
    <Card>
      <SectionHeader title="Sessões de leitura" icon="history" />
      {sessions.length === 0 ? (
        <Text variant="body" color="textMuted">
          Nenhuma sessão ainda. A primeira começa no botão acima.
        </Text>
      ) : (
        sessions.map((session) => (
          <View
            key={session.id}
            style={{
              gap: theme.spacing.xxs,
              paddingVertical: theme.spacing.xs,
              borderTopWidth: 1,
              borderTopColor: theme.colors.borderSoft,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label">{shortDate(session.localDate)}</Text>
              <Text variant="bodySm" color="textMuted">
                {formatDuration(session.focusedSeconds)} · {session.pagesRead} págs. · +
                {session.xpEarned} XP
              </Text>
            </View>
            {session.reflection ? (
              <Text variant="bodySm" color="textMuted" numberOfLines={3}>
                “{session.reflection}”
              </Text>
            ) : null}
          </View>
        ))
      )}
    </Card>
  );
}

function RecallCards({
  entry,
  cards,
  userId,
}: {
  entry: ShelfEntry;
  cards: RecallCard[];
  userId: string;
}) {
  const theme = useTheme();
  const create = useCreateCard(userId);
  const remove = useDeleteCard(userId);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const today = toLocalIsoDate(new Date());

  async function save() {
    if (prompt.trim() === '') {
      setError('Escreva a pergunta que você quer responder depois.');
      return;
    }
    setError(null);
    try {
      await create.mutateAsync({
        shelfEntryId: entry.id,
        prompt: prompt.trim().slice(0, RECALL_PROMPT_MAX),
        answer: answer.trim() === '' ? null : answer.trim().slice(0, RECALL_ANSWER_MAX),
        localDate: today,
      });
      haptics.success();
      setPrompt('');
      setAnswer('');
      setOpen(false);
    } catch {
      haptics.error();
      setError('Não foi possível criar o card agora.');
    }
  }

  const confirmDelete = (card: RecallCard) =>
    Alert.alert('Apagar este card?', card.prompt, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => remove.mutate(card.id) },
    ]);

  return (
    <Card>
      <SectionHeader title="Cards de recall" icon="style" />
      {cards.length === 0 ? (
        <Text variant="body" color="textMuted">
          Reflexões das suas sessões viram cards automaticamente. Você também pode criar os seus.
        </Text>
      ) : (
        cards.map((card) => (
          <View
            key={card.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingTop: theme.spacing.xs,
              borderTopWidth: 1,
              borderTopColor: theme.colors.borderSoft,
            }}
          >
            <View style={{ flex: 1, gap: theme.spacing.xxs }}>
              <Text variant="body" numberOfLines={2}>
                {card.prompt}
              </Text>
              <Text variant="bodySm" color="textMuted">
                Próxima revisão: {dueLabel(card.dueDate, today)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Apagar card: ${card.prompt}`}
              onPress={() => confirmDelete(card)}
              style={{
                width: theme.sizes.touchTarget,
                height: theme.sizes.touchTarget,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="delete-outline" size={22} color="textMuted" />
            </Pressable>
          </View>
        ))
      )}
      {open ? (
        <>
          <TextField
            label="Pergunta"
            icon="help-outline"
            placeholder="Ex.: Qual é a ideia central do capítulo 3?"
            value={prompt}
            onChangeText={setPrompt}
            multiline
          />
          <TextField
            label="Sua resposta (opcional)"
            icon="edit-note"
            placeholder="Fica escondida até você tentar lembrar"
            value={answer}
            onChangeText={setAnswer}
            multiline
            textAlignVertical="top"
          />
          {error ? <InlineMessage tone="error" message={error} /> : null}
          <Button
            label="Salvar card"
            size="md"
            icon="check"
            loading={create.isPending}
            onPress={save}
          />
        </>
      ) : (
        <Button
          label="Criar card"
          size="md"
          variant="secondary"
          icon="add"
          onPress={() => setOpen(true)}
        />
      )}
    </Card>
  );
}

/** Book detail: progress, status, history and the "start a session" entry point. */
export default function BookScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = typeof id === 'string' ? id : '';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const detail = useShelfEntry(userId, entryId);
  const remove = useDeleteShelfEntry(userId ?? '', entryId);

  if (!userId || detail.isPending) {
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
          mascot="notFound"
          title="Livro não encontrado"
          description="Ele pode ter sido removido da sua estante."
        />
      </FormScreen>
    );
  }

  const { entry, sessions, cards } = detail.data;
  const progress = readingProgress(entry.currentPage, entry.book.totalPages ?? 0);
  const status = STATUS_META[entry.status];

  const confirmRemove = () =>
    Alert.alert('Remover da estante?', `“${entry.book.title}” e as sessões dele serão apagados.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () =>
          remove.mutate(undefined, {
            onSuccess: () => {
              haptics.success();
              router.back();
            },
            onError: () => haptics.error(),
          }),
      },
    ]);

  return (
    <FormScreen
      title="Jornada Literária"
      eyebrow={entry.status === 'reading' ? 'Em leitura ativa' : status.label}
      footer={
        entry.status === 'finished' ? undefined : (
          <Button
            label={sessions.length > 0 ? 'Continuar leitura' : 'Iniciar sessão de leitura'}
            icon="play-arrow"
            fullWidth
            onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: entry.id } })}
          />
        )
      }
    >
      <Card>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <BookCover
            title={entry.book.title}
            author={entry.book.author}
            coverUrls={entry.book.coverUrls}
            width={96}
          />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="heading" accessibilityRole="header" numberOfLines={3}>
              {entry.book.title}
            </Text>
            {entry.book.author ? (
              <Text variant="body" color="textMuted">
                {entry.book.author}
              </Text>
            ) : null}
            <Chip label={status.label} tone={status.tone} icon={status.icon} />
          </View>
        </View>
        {progress.totalPages > 0 ? (
          <View style={{ gap: theme.spacing.xs }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label" color="accentText">
                {progress.percent}%
              </Text>
              <Text variant="bodySm" color="textMuted">
                Pág. {progress.currentPage} de {progress.totalPages}
              </Text>
            </View>
            <ProgressBar
              percent={progress.percent}
              accessibilityLabel={`Progresso de leitura: ${progress.percent}%`}
            />
          </View>
        ) : null}
      </Card>
      <Card>
        <SectionHeader title="Caminho de memória" icon="timeline" />
        <Text variant="bodySm" color="textMuted">
          Suas leituras e revisões deste livro, conforme forem registradas.
        </Text>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="bodyStrong">
            {sessions.length} {sessions.length === 1 ? 'sessão de leitura' : 'sessões de leitura'}
          </Text>
          <Text variant="bodyStrong">
            {cards.length} {cards.length === 1 ? 'card de memória' : 'cards de memória'}
          </Text>
        </View>
        {cards.some((card) => card.dueDate <= toLocalIsoDate(new Date())) ? (
          <Button
            label="Revisar agora"
            icon="psychology"
            variant="secondary"
            onPress={() => router.push('/revisao')}
          />
        ) : null}
      </Card>
      <StatusPicker entry={entry} userId={userId} />
      {/* Remount on status change (e.g. "Terminado" moves the page to the end). */}
      <ProgressEditor key={entry.status} entry={entry} userId={userId} />
      <SessionHistory sessions={sessions} />
      <RecallCards entry={entry} cards={cards} userId={userId} />
      {remove.isError ? (
        <InlineMessage tone="error" message="Não foi possível remover agora." />
      ) : null}
      <LinkButton label="Remover da estante" color="error" onPress={confirmRemove} />
    </FormScreen>
  );
}
