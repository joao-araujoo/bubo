import {
  type ReadingSession,
  type RecallCard,
  type ShelfEntry,
  type ShelfEntryDetail,
  RECALL_ANSWER_MAX,
  RECALL_PROMPT_MAX,
} from '@bubo/contracts';
import {
  MAX_BOOK_PAGES,
  MEMORY_PATH_MAX_PAST,
  buildMemoryPath,
  finishForecast,
  readingProgress,
  toLocalIsoDate,
} from '@bubo/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';

import {
  BottomSheet,
  Button,
  Card,
  EmptyState,
  FormScreen,
  HeaderButton,
  Icon,
  InlineMessage,
  LinkButton,
  ProgressBar,
  SectionHeader,
  SegmentedTabs,
  Text,
  TextField,
} from '../../design-system';
import {
  AlsoRead,
  CommunityRatingLine,
  ForecastLine,
  MarkToggles,
  RatingCard,
  ReadersFacts,
} from '../../features/book/BookExtras';
import { BookFacts, BookHero, Synopsis } from '../../features/book/BookHero';
import { formatDuration } from '../../features/session/useFocusTimer';
import { shortDate } from '../../features/shelf/labels';
import { MemoryPath } from '../../features/shelf/MemoryPath';
import { ShelfStatusPicker } from '../../features/shelf/ShelfStatusPicker';
import { BookClubReviews } from '../../features/community/BookClubReviews';
import { ApiError } from '../../lib/api/client';
import { dueLabel } from '../../features/recall/grades';
import {
  useBookCommunity,
  useCatalogBook,
  useCreateCard,
  useDeleteCard,
  useDeleteShelfEntry,
  useShelfEntry,
  useUpdateShelfEntry,
} from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

type Tab = 'reading' | 'about' | 'reviews' | 'cards';

const NUMBER = /^\d+$/;

function QuickPill({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: theme.sizes.touchTarget,
        paddingHorizontal: theme.spacing.lg,
        justifyContent: 'center',
        borderRadius: theme.radii.pill,
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.borderSoft,
        backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surface,
      })}
    >
      <Text variant="label" color="accentText">
        {label}
      </Text>
    </Pressable>
  );
}

function ProgressEditor({
  entry,
  userId,
  onSaved,
}: {
  entry: ShelfEntry;
  userId: string;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const update = useUpdateShelfEntry(userId, entry.id);
  const [page, setPage] = useState(String(entry.currentPage));
  const [total, setTotal] = useState(entry.book.totalPages ? String(entry.book.totalPages) : '');
  const [error, setError] = useState<string | null>(null);
  const totalKnown = NUMBER.test(total.trim()) ? Number(total.trim()) : null;

  function step(pages: number) {
    const current = NUMBER.test(page.trim()) ? Number(page.trim()) : entry.currentPage;
    const next = Math.max(0, current + pages);
    setPage(String(totalKnown !== null ? Math.min(next, totalKnown) : next));
  }

  async function save() {
    const currentPage = Number(page.trim());
    const totalPages = total.trim() === '' ? null : Number(total.trim());
    if (!NUMBER.test(page.trim()) || (total.trim() !== '' && !NUMBER.test(total.trim()))) {
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
      onSaved();
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
    <View style={{ gap: theme.spacing.md }}>
      <Text variant="title" accessibilityRole="header">
        Em que página você está?
      </Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Página atual"
            keyboardType="number-pad"
            value={page}
            onChangeText={setPage}
            returnKeyType="done"
            onSubmitEditing={() => void save()}
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
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {[10, 25, 50].map((pages) => (
          <QuickPill
            key={pages}
            label={`+${pages}`}
            accessibilityLabel={`Somar ${pages} páginas`}
            onPress={() => step(pages)}
          />
        ))}
        {totalKnown !== null ? (
          <QuickPill
            label="Última página"
            accessibilityLabel="Ir para a última página"
            onPress={() => setPage(String(totalKnown))}
          />
        ) : null}
      </View>
      {error ? <InlineMessage tone="error" message={error} /> : null}
      <Button
        label="Salvar progresso"
        icon="check"
        fullWidth
        loading={update.isPending}
        onPress={() => void save()}
      />
    </View>
  );
}

/** Progress at a glance, with the finish forecast; the page editor opens in a sheet. */
function ProgressCard({
  entry,
  userId,
  sessions,
}: {
  entry: ShelfEntry;
  userId: string;
  sessions: readonly ReadingSession[];
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const progress = readingProgress(entry.currentPage, entry.book.totalPages ?? 0);
  const forecast =
    progress.totalPages > 0 && entry.status === 'reading'
      ? finishForecast({
          sessions,
          today: toLocalIsoDate(new Date()),
          pagesLeft: progress.pagesLeft,
        })
      : null;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          {progress.totalPages > 0 ? (
            <>
              <Text variant="heading" color="accentText">
                {progress.percent}%
              </Text>
              <Text variant="bodySm" color="textMuted">
                Página {progress.currentPage} de {progress.totalPages}
              </Text>
            </>
          ) : (
            <>
              <Text variant="titleSm">Página {progress.currentPage}</Text>
              <Text variant="bodySm" color="textMuted">
                Informe o total de páginas para ver o progresso.
              </Text>
            </>
          )}
        </View>
        <Button
          label="Atualizar"
          icon="edit"
          size="md"
          variant="secondary"
          accessibilityLabel="Atualizar a página atual"
          onPress={() => {
            setSaved(false);
            setEditing(true);
          }}
        />
      </View>
      {progress.totalPages > 0 ? (
        <ProgressBar
          percent={progress.percent}
          accessibilityLabel={`Progresso de leitura: ${progress.percent}%`}
        />
      ) : null}
      {forecast ? <ForecastLine forecast={forecast} /> : null}
      {saved ? <InlineMessage tone="success" message="Progresso atualizado." /> : null}
      <BottomSheet
        visible={editing}
        onClose={() => setEditing(false)}
        accessibilityLabel="Atualizar progresso"
      >
        {editing ? (
          <ProgressEditor
            entry={entry}
            userId={userId}
            onSaved={() => {
              setEditing(false);
              setSaved(true);
            }}
          />
        ) : null}
      </BottomSheet>
    </Card>
  );
}

function SessionHistory({ sessions }: { sessions: ReadingSession[] }) {
  const theme = useTheme();
  return (
    <Card>
      <SectionHeader title="Sessões de leitura" icon="history" />
      {sessions.map((session) => (
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
      ))}
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
      {cards.map((card) => (
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
      ))}
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

/** Quiet blocks while the reading history arrives (the book itself is already on screen). */
function HistorySkeleton() {
  const theme = useTheme();
  return (
    <View accessible accessibilityLabel="Carregando histórico" style={{ gap: theme.spacing.md }}>
      {[120, 88].map((height) => (
        <View
          key={height}
          style={{
            height,
            borderRadius: theme.radii.card,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        />
      ))}
    </View>
  );
}

/** "Sobre": real facts and the catalog synopsis (loaded only when opened). */
function AboutTab({ entry, userId }: { entry: ShelfEntry; userId: string }) {
  const theme = useTheme();
  const catalog = useCatalogBook(userId, entry.book.catalogId ?? '');
  const book = catalog.data?.book;
  const facts = [
    entry.book.totalPages ? { label: 'Páginas', value: String(entry.book.totalPages) } : null,
    entry.book.publishedYear ? { label: 'Ano', value: String(entry.book.publishedYear) } : null,
    entry.rating ? { label: 'Sua nota', value: `${entry.rating}/5` } : null,
  ].filter((fact) => fact !== null);
  const edition = [
    entry.book.publisher ? `Editora ${entry.book.publisher}` : null,
    entry.book.isbn13 ? `ISBN ${entry.book.isbn13}` : null,
  ].filter(Boolean);
  return (
    <>
      <BookFacts facts={facts} />
      {entry.book.catalogId ? (
        catalog.isPending ? (
          <View style={{ gap: theme.spacing.sm }}>
            <Text variant="titleSm">Sinopse</Text>
            <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando" />
          </View>
        ) : book ? (
          <Synopsis text={book.description} />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            <InlineMessage tone="info" message="Não foi possível carregar a sinopse agora." />
            <Button
              label="Tentar de novo"
              icon="refresh"
              variant="secondary"
              size="md"
              loading={catalog.isFetching}
              onPress={() => void catalog.refetch()}
            />
          </View>
        )
      ) : (
        <InlineMessage
          tone="info"
          message="Livro cadastrado à mão: sinopse e dados de edição ficam como você preencheu."
        />
      )}
      {edition.length ? (
        <Text variant="bodySm" color="textMuted">
          {edition.join(' · ')}
        </Text>
      ) : null}
    </>
  );
}

/** Book page: hero, status, progress, then Leitura / Sobre / Cards (Skoob-style, ADR-042). */
export default function BookScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entryId = typeof id === 'string' ? id : '';
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const detail = useShelfEntry(userId, entryId);
  const community = useBookCommunity(userId, entryId);
  const remove = useDeleteShelfEntry(userId ?? '', entryId);
  const [tab, setTab] = useState<Tab>('reading');
  const [menu, setMenu] = useState(false);

  if (!userId || (detail.isPending && !detail.data)) {
    return (
      <FormScreen>
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando livro" />
      </FormScreen>
    );
  }
  if (
    detail.isError &&
    (!detail.data || !(detail.error instanceof ApiError && detail.error.retryable))
  ) {
    const missing = detail.error instanceof ApiError && detail.error.code === 'NOT_FOUND';
    return (
      <FormScreen title="Meu livro">
        <EmptyState
          mascot={missing ? 'notFound' : 'emptyShelf'}
          title={missing ? 'Livro não encontrado' : 'Não foi possível carregar o livro'}
          description={
            missing
              ? 'Ele pode ter sido removido da sua estante.'
              : 'Tente novamente para acessar os detalhes do livro.'
          }
          action={
            missing ? undefined : (
              <Button
                label="Tentar novamente"
                icon="refresh"
                loading={detail.isFetching}
                onPress={() => void detail.refetch()}
              />
            )
          }
        />
      </FormScreen>
    );
  }

  const data: ShelfEntryDetail = detail.data;
  const { entry, sessions, cards, reviews } = data;
  const loadingHistory = detail.isPlaceholderData;
  const today = toLocalIsoDate(new Date());
  const tracksPages = entry.status !== 'finished' && entry.status !== 'abandoned';

  const confirmRemove = () => {
    setMenu(false);
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
  };

  return (
    <FormScreen
      headerRight={
        <>
          <HeaderButton
            icon="ios-share"
            label="Compartilhar livro"
            onPress={() => router.push({ pathname: '/story/[id]', params: { id: entry.id } })}
          />
          <HeaderButton icon="more-vert" label="Mais opções" onPress={() => setMenu(true)} />
        </>
      }
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
      <BookHero
        title={entry.book.title}
        author={entry.book.author}
        coverUrls={entry.book.coverUrls}
        totalPages={entry.book.totalPages}
      >
        <CommunityRatingLine ratings={community.data?.ratings ?? null} />
      </BookHero>
      <ReadersFacts readers={community.data?.readers ?? null} />
      <ShelfStatusPicker entry={entry} userId={userId} />
      <MarkToggles entry={entry} userId={userId} />
      {detail.isError ? (
        <Card>
          <InlineMessage
            tone="error"
            message="Não conseguimos atualizar os detalhes agora. Tente novamente."
          />
          <Button
            label="Atualizar livro"
            variant="secondary"
            icon="refresh"
            size="md"
            loading={detail.isFetching}
            onPress={() => void detail.refetch()}
          />
        </Card>
      ) : null}
      {/* Remount on status change (e.g. "Lido" moves the page to the end). */}
      {tracksPages ? (
        <ProgressCard key={entry.status} entry={entry} userId={userId} sessions={sessions} />
      ) : null}
      <RatingCard entry={entry} userId={userId} ratings={community.data?.ratings} />
      <SegmentedTabs
        accessibilityLabel="Seções do livro"
        value={tab}
        onChange={setTab}
        options={[
          { id: 'reading', label: 'Leitura' },
          { id: 'about', label: 'Sobre' },
          { id: 'reviews', label: 'Resenhas' },
          {
            id: 'cards',
            label: 'Cards',
            ...(loadingHistory ? {} : { count: cards.length }),
          },
        ]}
      />
      {tab === 'reading' ? (
        loadingHistory ? (
          <HistorySkeleton />
        ) : (
          <>
            <MemoryPath
              steps={buildMemoryPath({
                today,
                sessions,
                reviews,
                cardDueDates: cards.map((card) => card.dueDate),
              })}
              today={today}
              truncated={sessions.length + reviews.length > MEMORY_PATH_MAX_PAST}
            />
            {sessions.length > 0 ? <SessionHistory sessions={sessions} /> : null}
          </>
        )
      ) : tab === 'about' ? (
        <AboutTab entry={entry} userId={userId} />
      ) : tab === 'reviews' ? (
        entry.book.catalogId ? (
          <BookClubReviews userId={userId} bookId={entry.book.id} />
        ) : (
          <InlineMessage
            tone="info"
            message="Resenhas ficam nos clubes que leem a mesma edição do catálogo. Este livro foi cadastrado à mão."
          />
        )
      ) : loadingHistory ? (
        <HistorySkeleton />
      ) : (
        <RecallCards entry={entry} cards={cards} userId={userId} />
      )}
      <AlsoRead items={community.data?.alsoRead ?? []} />
      {remove.isError ? (
        <InlineMessage tone="error" message="Não foi possível remover agora." />
      ) : null}
      <BottomSheet visible={menu} onClose={() => setMenu(false)} accessibilityLabel="Mais opções">
        <Text variant="title" accessibilityRole="header" numberOfLines={2}>
          {entry.book.title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Criar story do livro"
          onPress={() => {
            setMenu(false);
            router.push({ pathname: '/story/[id]', params: { id: entry.id } });
          }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            minHeight: 56,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radii.md,
            backgroundColor: pressed ? theme.colors.primarySoft : undefined,
          })}
        >
          <Icon name="ios-share" size={22} color="accentText" />
          <Text variant="bodyStrong">Criar story do livro</Text>
        </Pressable>
        <View style={{ alignItems: 'flex-start' }}>
          <LinkButton label="Remover da estante" color="error" onPress={confirmRemove} />
        </View>
      </BottomSheet>
    </FormScreen>
  );
}
