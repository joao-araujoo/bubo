import { type ShelfEntry } from '@bubo/contracts';
import {
  type LibraryShelf,
  LIBRARY_SHELVES,
  inLibraryShelf,
  libraryCounts,
  readingProgress,
} from '@bubo/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { type ComponentProps, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import {
  BookCover,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  FormScreen,
  HeaderButton,
  Icon,
  InlineMessage,
  ProgressBar,
  Text,
} from '../design-system';
import { StarRating } from '../features/community/StarRating';
import { SHELF_META } from '../features/shelf/Library';
import { STATUS_META } from '../features/shelf/labels';
import { ApiError } from '../lib/api/client';
import { useShelf } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

type Filter = 'all' | LibraryShelf;
type Sort = 'recent' | 'title' | 'author' | 'rating';
type IconName = ComponentProps<typeof Icon>['name'];
const EMPTY_ENTRIES: ShelfEntry[] = [];
const COLUMNS = 3;
const ALWAYS_SHOWN: readonly Filter[] = ['all', 'reading', 'want_to_read', 'finished'];
type SortOption = { id: Sort; label: string; icon: IconName };
const DEFAULT_SORT: SortOption = { id: 'recent', label: 'Recentes', icon: 'schedule' };
const SORTS: SortOption[] = [
  DEFAULT_SORT,
  { id: 'title', label: 'Título', icon: 'sort-by-alpha' },
  { id: 'author', label: 'Autor', icon: 'person-outline' },
  { id: 'rating', label: 'Sua nota', icon: 'star-outline' },
];

function isFilter(value: unknown): value is Filter {
  return value === 'all' || (LIBRARY_SHELVES as readonly unknown[]).includes(value);
}

function searchText(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim();
}

/** Small status mark on the cover corner when several shelves are shown together. */
function StatusMark({ entry }: { entry: ShelfEntry }) {
  const theme = useTheme();
  const finished = entry.status === 'finished';
  return (
    <View
      style={{
        position: 'absolute',
        top: theme.spacing.xs,
        left: theme.spacing.xs,
        width: 26,
        height: 26,
        borderRadius: theme.radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.surface,
        backgroundColor: finished ? theme.colors.success : theme.colors.primary,
      }}
    >
      <Icon
        name={finished ? 'check' : entry.rereading ? 'replay' : STATUS_META[entry.status].icon}
        size={14}
        color="onPrimary"
      />
    </View>
  );
}

/** Grid tile (Skoob-style): the cover first, then title, and the rating or the progress. */
function ShelfTile({
  entry,
  width,
  showStatus,
}: {
  entry: ShelfEntry;
  width: number;
  showStatus: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const progress = readingProgress(entry.currentPage, entry.book.totalPages ?? 0);
  const showProgress =
    progress.totalPages > 0 && (entry.status === 'reading' || entry.status === 'paused');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        entry.book.title,
        entry.book.author,
        entry.rereading ? 'Relendo' : STATUS_META[entry.status].label,
        entry.favorite ? 'favorito' : null,
        entry.rating ? `nota ${entry.rating} de 5` : null,
        showProgress ? `${progress.percent}% lido` : null,
      ]
        .filter(Boolean)
        .join(', ')}
      accessibilityHint="Abre os detalhes do livro"
      onPress={() => {
        haptics.selection();
        router.push({ pathname: '/livro/[id]', params: { id: entry.id } });
      }}
      style={({ pressed }) => ({ width, gap: theme.spacing.xs, opacity: pressed ? 0.85 : 1 })}
    >
      <View>
        <BookCover
          title={entry.book.title}
          author={entry.book.author}
          coverUrls={entry.book.coverUrls}
          width={width}
        />
        {showStatus && entry.status !== 'want_to_read' ? <StatusMark entry={entry} /> : null}
        {entry.favorite ? (
          <View
            style={{
              position: 'absolute',
              top: theme.spacing.xs,
              right: theme.spacing.xs,
              width: 26,
              height: 26,
              borderRadius: theme.radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.surface,
            }}
          >
            <Icon name="favorite" size={15} color="error" />
          </View>
        ) : null}
        {showProgress ? (
          <View
            style={{
              position: 'absolute',
              left: theme.spacing.xs,
              right: theme.spacing.xs,
              bottom: theme.spacing.xs,
            }}
          >
            <ProgressBar
              percent={progress.percent}
              size="sm"
              accessibilityLabel={`Progresso de leitura: ${progress.percent}%`}
            />
          </View>
        ) : null}
      </View>
      <Text variant="bodySm" numberOfLines={2} style={{ fontFamily: theme.fontFamily.semibold }}>
        {entry.book.title}
      </Text>
      {entry.rating ? (
        <StarRating value={entry.rating} size={11} />
      ) : showProgress ? (
        <Text variant="meta" color="accentText">
          {progress.percent}% lido
        </Text>
      ) : entry.book.author ? (
        <Text variant="meta" color="textMuted" numberOfLines={1}>
          {entry.book.author}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Counter tiles that double as filters ("12 Lidos"), like Skoob's shelf summary. */
function FilterTiles({
  entries,
  filter,
  onChange,
}: {
  entries: readonly ShelfEntry[];
  filter: Filter;
  onChange: (filter: Filter) => void;
}) {
  const theme = useTheme();
  const counts = useMemo(() => libraryCounts(entries), [entries]);
  const options: Filter[] = ['all', ...LIBRARY_SHELVES];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -theme.sizes.gutter }}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: theme.sizes.gutter }}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Filtrar livros por prateleira"
        style={{ flexDirection: 'row', gap: theme.spacing.sm }}
      >
        {options
          .filter(
            (option) =>
              ALWAYS_SHOWN.includes(option) ||
              option === filter ||
              (option !== 'all' && counts[option] > 0),
          )
          .map((option) => {
            const count = option === 'all' ? entries.length : counts[option];
            const meta =
              option === 'all'
                ? { label: 'Todos', icon: 'collections-bookmark' as IconName }
                : SHELF_META[option];
            const selected = filter === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${meta.label}, ${count} ${count === 1 ? 'livro' : 'livros'}`}
                onPress={() => {
                  haptics.selection();
                  onChange(option);
                }}
                style={({ pressed }) => ({
                  minWidth: 84,
                  minHeight: 64,
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  justifyContent: 'center',
                  gap: 2,
                  borderRadius: theme.radii.lg,
                  borderWidth: theme.sizes.borderWidth,
                  borderColor: selected ? theme.colors.primary : theme.colors.borderSoft,
                  backgroundColor: selected
                    ? theme.colors.primary
                    : pressed
                      ? theme.colors.primarySoft
                      : theme.colors.surface,
                })}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
                  <Icon name={meta.icon} size={16} color={selected ? 'onPrimary' : 'accentText'} />
                  <Text variant="title" color={selected ? 'onPrimary' : 'text'}>
                    {count}
                  </Text>
                </View>
                <Text variant="bodySm" color={selected ? 'onPrimary' : 'textMuted'}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
      </View>
    </ScrollView>
  );
}

/** Every book of the shelf as a grid (ADR-042/046): shelf filters, local search and ordering. */
export default function ShelfListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ filtro?: string; ano?: string }>();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const shelf = useShelf(userId);
  const [filter, setFilter] = useState<Filter>(isFilter(params.filtro) ? params.filtro : 'all');
  const [year, setYear] = useState<number | null>(
    params.ano && /^\d{4}$/.test(params.ano) ? Number(params.ano) : null,
  );
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [sorting, setSorting] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const columnGap = theme.spacing.md;
  const tileWidth = Math.floor(
    (windowWidth - theme.sizes.gutter * 2 - columnGap * (COLUMNS - 1)) / COLUMNS,
  );
  const currentSort = SORTS.find((option) => option.id === sort) ?? DEFAULT_SORT;
  const canUseShelfData =
    !shelf.isError || (shelf.error instanceof ApiError && shelf.error.retryable);
  const entries = canUseShelfData ? (shelf.data?.entries ?? EMPTY_ENTRIES) : EMPTY_ENTRIES;
  const filtered = useMemo(() => {
    const query = searchText(search);
    const result = entries.filter(
      (entry) =>
        (filter === 'all' || inLibraryShelf(entry, filter)) &&
        (year === null || entry.finishedAt?.startsWith(`${year}-`) === true) &&
        (query === '' ||
          searchText(`${entry.book.title} ${entry.book.author ?? ''}`).includes(query)),
    );
    if (sort === 'rating') {
      result.sort((left, right) => (right.rating ?? 0) - (left.rating ?? 0));
    } else if (sort !== 'recent') {
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
  }, [entries, filter, search, sort, year]);
  const openAdd = () =>
    router.push({
      pathname: '/adicionar-livro',
      params: { status: filter === 'reading' || filter === 'finished' ? filter : 'want_to_read' },
    });
  const openDiscover = () => router.push({ pathname: '/descobrir', params: { focus: '1' } });
  const showStatus =
    filter === 'all' || filter === 'favorite' || filter === 'owned' || filter === 'wishlist';

  return (
    <FormScreen
      title={year !== null ? `Lidos em ${year}` : 'Minha estante'}
      scroll={false}
      headerRight={
        <>
          <HeaderButton
            icon="shelves"
            label="Ver estante 3D"
            onPress={() => router.push('/estante-3d')}
          />
          <HeaderButton icon="add" label="Adicionar livro" onPress={openAdd} />
        </>
      }
    >
      <FlatList
        data={userId ? filtered : EMPTY_ENTRIES}
        keyExtractor={(entry) => entry.id}
        renderItem={({ item }) => (
          <ShelfTile entry={item} width={tileWidth} showStatus={showStatus} />
        )}
        numColumns={COLUMNS}
        columnWrapperStyle={{ gap: columnGap }}
        initialNumToRender={12}
        maxToRenderPerBatch={9}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        refreshing={shelf.isRefetching}
        onRefresh={() => void shelf.refetch()}
        style={{ paddingHorizontal: theme.sizes.gutter }}
        contentContainerStyle={{
          gap: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
        }}
        ListHeaderComponent={
          <View style={{ gap: theme.spacing.lg }}>
            {entries.length ? (
              <FilterTiles
                entries={entries}
                filter={filter}
                onChange={(next) => {
                  setFilter(next);
                  if (next !== 'finished') setYear(null);
                }}
              />
            ) : null}
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
            {entries.length ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.xs,
                    minHeight: theme.sizes.touchTarget,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radii.pill,
                    backgroundColor: theme.colors.surfaceMuted,
                  }}
                >
                  <Icon name="filter-list" size={18} color="textMuted" />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Filtrar minha estante"
                    placeholderTextColor={theme.colors.textMuted}
                    selectionColor={theme.colors.primary}
                    accessibilityLabel="Filtrar minha estante por título ou autor"
                    autoCorrect={false}
                    returnKeyType="search"
                    maxFontSizeMultiplier={1.6}
                    style={[
                      theme.typography.bodySm,
                      { flex: 1, color: theme.colors.text, paddingVertical: theme.spacing.xs },
                    ]}
                  />
                  {search ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Limpar filtro"
                      hitSlop={8}
                      onPress={() => setSearch('')}
                    >
                      <Icon name="close" size={18} color="textMuted" />
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ordenar por ${currentSort.label.toLocaleLowerCase('pt-BR')}`}
                  accessibilityHint="Abre as opções de ordenação"
                  onPress={() => {
                    haptics.selection();
                    setSorting(true);
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.xxs,
                    minHeight: theme.sizes.touchTarget,
                    paddingHorizontal: theme.spacing.md,
                    borderRadius: theme.radii.pill,
                    borderWidth: theme.sizes.borderWidth,
                    borderColor: theme.colors.borderSoft,
                    backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surface,
                  })}
                >
                  <Icon name="swap-vert" size={18} color="accentText" />
                  <Text variant="label" color="text">
                    {currentSort.label}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {!shelf.isPending && filtered.length > 0 && (search.trim() || filter !== 'all') ? (
              <Text variant="bodySm" color="textMuted" accessibilityLiveRegion="polite">
                {filtered.length} {filtered.length === 1 ? 'livro' : 'livros'}
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
                    ? 'Sua estante está esperando'
                    : search.trim()
                      ? 'Nenhum livro encontrado'
                      : 'Nenhum livro nesta prateleira'
                }
                description={
                  entries.length === 0
                    ? 'Busque um livro, leia o código de barras ou explore as recomendações do Bubo.'
                    : search.trim()
                      ? 'Tente outro título ou autor, ou busque um novo livro para adicionar.'
                      : filter === 'favorite' || filter === 'owned' || filter === 'wishlist'
                        ? 'Marque Favorito, Tenho ou Desejado na página de um livro.'
                        : filter === 'paused' || filter === 'abandoned'
                          ? 'Abra um livro para mudar o status dele.'
                          : 'Você pode adicionar um livro diretamente com esse status.'
                }
                action={
                  entries.length === 0 ? (
                    <View style={{ gap: theme.spacing.sm, alignSelf: 'stretch' }}>
                      <Button
                        label="Buscar livros"
                        icon="search"
                        fullWidth
                        onPress={openDiscover}
                      />
                      <Button
                        label="Adicionar livro"
                        icon="add"
                        variant="secondary"
                        fullWidth
                        onPress={openAdd}
                      />
                    </View>
                  ) : (
                    <Button
                      label="Limpar filtros"
                      icon="filter-list-off"
                      fullWidth
                      onPress={() => {
                        setFilter('all');
                        setYear(null);
                        setSearch('');
                      }}
                    />
                  )
                }
              />
            </Card>
          )
        }
      />
      <BottomSheet
        visible={sorting}
        onClose={() => setSorting(false)}
        accessibilityLabel="Ordenar livros"
      >
        <Text variant="title" accessibilityRole="header">
          Ordenar por
        </Text>
        <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.xs }}>
          {SORTS.map((option) => {
            const selected = sort === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  haptics.selection();
                  setSort(option.id);
                  setSorting(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  minHeight: 56,
                  paddingHorizontal: theme.spacing.md,
                  borderRadius: theme.radii.md,
                  backgroundColor: selected ? theme.colors.primarySoft : undefined,
                }}
              >
                <Icon name={option.icon} size={22} color={selected ? 'accentText' : 'textMuted'} />
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {option.label}
                </Text>
                {selected ? <Icon name="check" size={22} color="accentText" /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </FormScreen>
  );
}
