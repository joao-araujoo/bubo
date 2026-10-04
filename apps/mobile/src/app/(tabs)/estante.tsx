import { type ShelfEntry } from '@bubo/contracts';
import { readingProgress, type ReadingStatus } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from 'react-native';

import {
  BookCover,
  Button,
  Card,
  EmptyState,
  HeaderButton,
  Icon,
  InlineMessage,
  ProgressBar,
  Screen,
  Text,
  TextField,
} from '../../design-system';
import { STATUS_META } from '../../features/shelf/labels';
import { ShelfStatusPicker } from '../../features/shelf/ShelfStatusPicker';
import { ApiError } from '../../lib/api/client';
import { useShelf } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

type Filter = 'all' | ReadingStatus;
type Sort = 'recent' | 'title' | 'author';
const EMPTY_ENTRIES: ShelfEntry[] = [];
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'reading', label: 'Lendo' },
  { id: 'want_to_read', label: 'Quero ler' },
  { id: 'finished', label: 'Lidos' },
  { id: 'paused', label: 'Pausados' },
  { id: 'abandoned', label: 'Abandonados' },
];
const SORTS: { id: Sort; label: string }[] = [
  { id: 'recent', label: 'Recentes' },
  { id: 'title', label: 'Título' },
  { id: 'author', label: 'Autor' },
];

function searchText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function ShelfRow({ entry, userId }: { entry: ShelfEntry; userId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const progress = readingProgress(entry.currentPage, entry.book.totalPages ?? 0);
  return (
    <Card style={{ gap: theme.spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${entry.book.title}, ${STATUS_META[entry.status].label}${progress.totalPages > 0 ? `, ${progress.percent}%` : ''}`}
        accessibilityHint="Abre os detalhes do livro"
        onPress={() => {
          haptics.selection();
          router.push({ pathname: '/livro/[id]', params: { id: entry.id } });
        }}
      >
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
          <BookCover
            title={entry.book.title}
            author={entry.book.author}
            coverUrls={entry.book.coverUrls}
            width={72}
          />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="titleSm" numberOfLines={2}>
              {entry.book.title}
            </Text>
            {entry.book.author ? (
              <Text variant="bodySm" color="textMuted" numberOfLines={1}>
                {entry.book.author}
              </Text>
            ) : null}
            <Text variant="label" color="accentText">
              {STATUS_META[entry.status].label}
            </Text>
            {progress.totalPages > 0 &&
            (entry.status === 'reading' || entry.status === 'paused') ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="bodySm" color="textMuted">
                    Pág. {progress.currentPage} de {progress.totalPages}
                  </Text>
                  <Text variant="label" color="accentText">
                    {progress.percent}%
                  </Text>
                </View>
                <ProgressBar
                  percent={progress.percent}
                  accessibilityLabel={`Progresso de leitura: ${progress.percent}%`}
                />
              </>
            ) : null}
          </View>
          <Icon name="chevron-right" size={24} color="textMuted" />
        </View>
      </Pressable>
      <ShelfStatusPicker entry={entry} userId={userId} compact />
    </Card>
  );
}

export default function ShelfScreen() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const shelf = useShelf(userId);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const canUseShelfData =
    !shelf.isError || (shelf.error instanceof ApiError && shelf.error.retryable);
  const entries = canUseShelfData ? (shelf.data?.entries ?? EMPTY_ENTRIES) : EMPTY_ENTRIES;
  const filtered = useMemo(() => {
    const query = searchText(search);
    const result = entries.filter(
      (entry) =>
        (filter === 'all' || entry.status === filter) &&
        (query === '' ||
          searchText(`${entry.book.title} ${entry.book.author ?? ''}`).includes(query)),
    );
    if (sort !== 'recent') {
      result.sort((left, right) => {
        const a = sort === 'author' ? (left.book.author ?? '') : left.book.title;
        const b = sort === 'author' ? (right.book.author ?? '') : right.book.title;
        return (
          a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) ||
          left.book.title.localeCompare(right.book.title, 'pt-BR', { sensitivity: 'base' })
        );
      });
    }
    return result;
  }, [entries, filter, search, sort]);
  const openAdd = () =>
    router.push({
      pathname: '/adicionar-livro',
      params: { status: filter === 'reading' || filter === 'finished' ? filter : 'want_to_read' },
    });

  return (
    <Screen
      scroll={false}
      header={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="heading" accessibilityRole="header">
              Minha Estante
            </Text>
            {shelf.data && canUseShelfData ? (
              <Text variant="bodySm" color="textMuted">
                {entries.length} {entries.length === 1 ? 'livro' : 'livros'} na sua coleção
              </Text>
            ) : null}
          </View>
          <HeaderButton
            icon="explore"
            label="Descobrir livros"
            onPress={() => router.push('/descobrir')}
          />
          <Button label="Adicionar livro" icon="add" iconOnly size="md" onPress={openAdd} />
        </View>
      }
    >
      <FlatList
        data={userId ? filtered : EMPTY_ENTRIES}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => (userId ? <ShelfRow entry={item} userId={userId} /> : null)}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshing={shelf.isRefetching}
        onRefresh={() => void shelf.refetch()}
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.md }}>
            <Button label="Adicionar livro" icon="add" fullWidth size="md" onPress={openAdd} />
            <TextField
              label="Buscar na minha estante"
              icon="search"
              hideLabel
              placeholder="Título ou autor na sua estante"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              returnKeyType="search"
            />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: theme.spacing.xs, paddingVertical: theme.spacing.xxs }}
            >
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel="Filtrar livros por status"
                style={{ flexDirection: 'row', gap: theme.spacing.xs }}
              >
                {FILTERS.map((option) => {
                  const count =
                    option.id === 'all'
                      ? entries.length
                      : entries.filter((entry) => entry.status === option.id).length;
                  const selected = filter === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${option.label}, ${count} livros`}
                      onPress={() => {
                        haptics.selection();
                        setFilter(option.id);
                      }}
                      style={{
                        minHeight: theme.sizes.touchTarget,
                        paddingHorizontal: theme.spacing.md,
                        borderRadius: theme.radii.pill,
                        borderWidth: theme.sizes.borderWidth,
                        borderColor: selected ? theme.colors.primary : theme.colors.borderSoft,
                        backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text variant="label" color={selected ? 'onPrimary' : 'textMuted'}>
                        {option.label} {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Ordenar livros"
              style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
            >
              <Text variant="bodySm" color="textMuted" style={{ marginRight: theme.spacing.xs }}>
                Ordenar
              </Text>
              {SORTS.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: sort === option.id }}
                  accessibilityLabel={`Ordenar por ${option.label.toLocaleLowerCase('pt-BR')}`}
                  onPress={() => {
                    haptics.selection();
                    setSort(option.id);
                  }}
                  style={{
                    minHeight: theme.sizes.touchTarget,
                    paddingHorizontal: theme.spacing.sm,
                    justifyContent: 'center',
                    borderRadius: theme.radii.pill,
                    backgroundColor: sort === option.id ? theme.colors.primarySoft : undefined,
                  }}
                >
                  <Text variant="label" color={sort === option.id ? 'accentText' : 'textMuted'}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {shelf.isError && shelf.data && canUseShelfData ? (
              <Card>
                <InlineMessage
                  tone="error"
                  message="Sua estante está salva aqui, mas não conseguimos atualizá-la agora."
                />
                <Button
                  label="Tentar atualizar"
                  variant="secondary"
                  icon="refresh"
                  size="md"
                  loading={shelf.isFetching}
                  onPress={() => void shelf.refetch()}
                />
              </Card>
            ) : null}
            {!shelf.isPending && filtered.length > 0 ? (
              <Text variant="bodySm" color="textMuted" accessibilityLiveRegion="polite">
                {filtered.length} {filtered.length === 1 ? 'livro' : 'livros'}
                {filter === 'all'
                  ? ''
                  : ` · ${FILTERS.find((option) => option.id === filter)?.label}`}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          shelf.isPending || !userId ? (
            <ActivityIndicator
              color={theme.colors.primary}
              accessibilityLabel="Carregando sua estante"
            />
          ) : shelf.isError && (!shelf.data || !canUseShelfData) ? (
            <Card>
              <InlineMessage tone="error" message="Não foi possível carregar sua estante agora." />
              <Button
                label="Tentar de novo"
                variant="secondary"
                icon="refresh"
                onPress={() => void shelf.refetch()}
              />
            </Card>
          ) : (
            <Card>
              <EmptyState
                mascot="emptyShelf"
                title={
                  entries.length === 0
                    ? 'Sua estante está vazia'
                    : search.trim()
                      ? 'Nenhum livro encontrado'
                      : 'Nenhum livro nesta categoria'
                }
                description={
                  entries.length === 0
                    ? 'Guarde o que quer ler, o que está lendo e os livros que já leu.'
                    : search.trim()
                      ? 'Tente outro título ou autor, ou busque um novo livro para adicionar.'
                      : filter === 'paused' || filter === 'abandoned'
                        ? 'Use as opções de status de cada livro para organizar esta categoria.'
                        : 'Você pode adicionar um livro diretamente com esse status.'
                }
                action={
                  <Button
                    label={entries.length === 0 ? 'Adicionar livro' : 'Limpar filtros'}
                    icon={entries.length === 0 ? 'add' : 'filter-list-off'}
                    fullWidth
                    onPress={
                      entries.length === 0
                        ? openAdd
                        : () => {
                            setFilter('all');
                            setSearch('');
                          }
                    }
                  />
                }
              />
            </Card>
          )
        }
      />
    </Screen>
  );
}
