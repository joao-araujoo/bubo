import { type CatalogBook, type DiscoverItem, type DiscoverSection } from '@bubo/contracts';
import { type Genre, MIN_CATALOG_QUERY_LENGTH } from '@bubo/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';

import {
  BuboMascot,
  Button,
  Card,
  EmptyState,
  FormScreen,
  Icon,
  InlineMessage,
  Text,
} from '../design-system';
import { useQuickAdd } from '../features/catalog/AddToShelfSheet';
import { catalogErrorMessage, useDebouncedValue } from '../features/catalog/catalog';
import { CatalogBookRow } from '../features/catalog/CatalogBookRow';
import { CatalogSearchResults } from '../features/catalog/CatalogSearchResults';
import { CoverCard, CoverCarouselSkeleton } from '../features/catalog/CoverCard';
import { prefetchCovers } from '../features/catalog/prefetch';
import { SearchField } from '../features/catalog/SearchField';
import { useShelfLookup } from '../features/catalog/useAddFromCatalog';
import { GENRE_OPTIONS } from '../features/onboarding/options';
import { useCatalogDiscover, useCatalogSearch } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

type Topic = 'for_you' | Genre;
const NO_INTERESTS: readonly Genre[] = [];

/** Cover widths: the first shelf is the showcase, the others are denser. */
const LARGE = 136;
const COMPACT = 108;

function TopicChip({
  label,
  selected,
  icon,
  onPress,
}: {
  label: string;
  selected: boolean;
  icon?: 'auto-awesome';
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        minHeight: theme.sizes.touchTarget,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.pill,
        borderWidth: theme.sizes.borderWidth,
        borderColor: selected ? theme.colors.primary : theme.colors.borderSoft,
        backgroundColor: selected
          ? theme.colors.primary
          : pressed
            ? theme.colors.primarySoft
            : theme.colors.surface,
      })}
    >
      {icon ? <Icon name={icon} size={18} color={selected ? 'onPrimary' : 'accentText'} /> : null}
      <Text variant="label" color={selected ? 'onPrimary' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

function ShelfTitle({ title, subtitle }: { title: string; subtitle?: string | null }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{ width: 5, height: 20, borderRadius: 3, backgroundColor: theme.colors.primary }}
        />
        <Text variant="titleSm" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {subtitle ? (
        <Text variant="bodySm" color="textMuted" style={{ marginLeft: 5 + theme.spacing.sm }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

function TipCard({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Card tone="muted">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BuboMascot pose="takingNotes" size={64} />
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text variant="caption" color="accentDeep">
            Dica do Bubo
          </Text>
          <Text variant="bodySm">{text}</Text>
        </View>
      </View>
    </Card>
  );
}

const noteFor = (item: DiscoverItem) =>
  item.readers
    ? `${item.readers} ${item.readers === 1 ? 'leitor' : 'leitores'} no Bubo`
    : item.reason;

/** Descobrir: Skoob-style search with quick "+", recommendation shelves (ADR-031) and ISBN. */
export default function DiscoverScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; focus?: string }>();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const interests = auth.status === 'ready' ? auth.me.profile.interests : NO_INTERESTS;

  const [text, setText] = useState(params.q ?? '');
  const [topic, setTopic] = useState<Topic>('for_you');
  const typed = useDebouncedValue(text.trim(), 300);
  const searching = text.trim().length >= MIN_CATALOG_QUERY_LENGTH;

  const topics = useMemo(
    () => [
      ...GENRE_OPTIONS.filter((genre) => interests.includes(genre.id)),
      ...GENRE_OPTIONS.filter((genre) => !interests.includes(genre.id)),
    ],
    [interests],
  );

  const results = useCatalogSearch(userId, searching ? typed : '');
  const books = useMemo(() => results.data?.results ?? [], [results.data]);
  const partial = Object.values(results.data?.sources ?? {}).some((status) => status === 'error');

  const discover = useCatalogDiscover(userId, topic === 'for_you' ? null : topic, !searching);
  const sections = useMemo(() => discover.data?.sections ?? [], [discover.data]);

  // Warm the image cache as soon as shelves arrive, before their cards scroll into view.
  useEffect(() => {
    sections.forEach((section, index) =>
      prefetchCovers(
        section.items.slice(0, 6).map((entry) => entry.book),
        index === 0 ? LARGE : COMPACT,
      ),
    );
  }, [sections]);

  const quick = useQuickAdd(userId);
  const entryFor = useShelfLookup(userId);

  const open = (book: CatalogBook) =>
    router.push({ pathname: '/catalogo/[id]', params: { id: book.catalogId } });
  const openEntry = (id: string) => router.push({ pathname: '/livro/[id]', params: { id } });
  const scan = () => router.push({ pathname: '/scanner-isbn', params: { status: 'want_to_read' } });
  const manual = () =>
    router.push({ pathname: '/adicionar-livro', params: { manual: '1', status: 'want_to_read' } });

  const carousel = (section: DiscoverSection, width: number, max = 15) => (
    <View style={{ gap: theme.spacing.md }}>
      <ShelfTitle title={section.title} subtitle={section.subtitle} />
      <FlatList
        horizontal
        data={section.items.slice(0, max)}
        keyExtractor={(entry) => entry.book.catalogId}
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -theme.sizes.gutter }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingHorizontal: theme.sizes.gutter }}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={3}
        renderItem={({ item, index }) => (
          <CoverCard
            book={item.book}
            width={width}
            note={noteFor(item)}
            noteIcon={item.readers ? 'groups' : 'auto-awesome'}
            priority={index < 3 ? 'high' : 'normal'}
            entryId={entryFor(item.book)}
            adding={quick.pendingId === item.book.catalogId}
            disabled={quick.pendingId !== null}
            onOpen={() => open(item.book)}
            onAdd={() => quick.open(item.book)}
            onOpenEntry={openEntry}
          />
        )}
      />
    </View>
  );

  const basedOn = discover.data?.basedOn;
  const coldStart =
    topic === 'for_you' && basedOn !== undefined && basedOn.books === 0 && basedOn.interests === 0;
  const genreSection = topic === 'for_you' ? null : (sections[0] ?? null);
  const empty = !sections.length || (genreSection !== null && !genreSection.items.length);

  return (
    <FormScreen title="Descobrir" scroll={false}>
      <View
        style={{
          flex: 1,
          paddingHorizontal: theme.sizes.gutter,
          paddingTop: theme.spacing.lg,
          gap: theme.spacing.lg,
        }}
      >
        <SearchField
          value={text}
          onChangeText={setText}
          onScanPress={scan}
          placeholder="Título, autor ou ISBN"
          autoFocus={params.focus === '1'}
          loading={searching && (text.trim() !== typed || results.isFetching)}
        />
        {searching ? (
          <CatalogSearchResults
            inset={false}
            books={books}
            searching
            loading={results.isPending}
            updating={text.trim() !== typed && !results.data}
            error={results.isError ? catalogErrorMessage(results.error) : null}
            partial={partial}
            pendingId={quick.pendingId}
            entryFor={entryFor}
            onOpen={open}
            onOpenEntry={openEntry}
            onAdd={quick.open}
            onRetry={() => void results.refetch()}
            onManual={manual}
            header={null}
          />
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: theme.spacing.xl, paddingBottom: theme.spacing.xxl }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              accessibilityRole="tablist"
              style={{ marginHorizontal: -theme.sizes.gutter }}
              contentContainerStyle={{
                gap: theme.spacing.sm,
                paddingHorizontal: theme.sizes.gutter,
              }}
            >
              <TopicChip
                label="Para você"
                icon="auto-awesome"
                selected={topic === 'for_you'}
                onPress={() => setTopic('for_you')}
              />
              {topics.map((genre) => (
                <TopicChip
                  key={genre.id}
                  label={genre.title}
                  selected={topic === genre.id}
                  onPress={() => setTopic(genre.id)}
                />
              ))}
            </ScrollView>

            {discover.isPending ? (
              <>
                <View style={{ gap: theme.spacing.md }}>
                  <ShelfTitle title={topic === 'for_you' ? 'Para você' : 'Mais lidos'} />
                  <CoverCarouselSkeleton width={LARGE} />
                </View>
                <CoverCarouselSkeleton width={COMPACT} />
              </>
            ) : discover.isError && !discover.data ? (
              <View style={{ gap: theme.spacing.md }}>
                <InlineMessage tone="error" message={catalogErrorMessage(discover.error)} />
                <Button
                  label="Tentar de novo"
                  icon="refresh"
                  variant="secondary"
                  size="md"
                  onPress={() => void discover.refetch()}
                />
              </View>
            ) : (
              <>
                {discover.data?.sources.openlibrary === 'error' && !sections.length ? (
                  <InlineMessage
                    tone="info"
                    message="A biblioteca de livros não respondeu agora. Tente de novo em instantes."
                  />
                ) : null}
                {coldStart ? (
                  <TipCard text="Adicione livros à sua estante e o Bubo passa a recomendar leituras parecidas com as suas." />
                ) : null}
                {genreSection ? (
                  <>
                    {carousel(genreSection, LARGE, 10)}
                    {genreSection.items.length > 10 ? (
                      <View style={{ gap: theme.spacing.sm }}>
                        <ShelfTitle title="Mais nessa prateleira" />
                        {genreSection.items.slice(10).map((entry) => (
                          <CatalogBookRow
                            key={entry.book.catalogId}
                            book={entry.book}
                            onOpen={() => open(entry.book)}
                            entryId={entryFor(entry.book)}
                            onOpenEntry={openEntry}
                            onAdd={() => quick.open(entry.book)}
                            adding={quick.pendingId === entry.book.catalogId}
                            disabled={quick.pendingId !== null}
                          />
                        ))}
                      </View>
                    ) : null}
                  </>
                ) : (
                  sections.map((section, index) => (
                    <View key={section.id}>{carousel(section, index === 0 ? LARGE : COMPACT)}</View>
                  ))
                )}
                {empty ? (
                  <EmptyState
                    mascot="notFound"
                    title="Nada por aqui ainda"
                    description="Não encontramos livros para essa prateleira agora. Tente outro gênero ou busque pelo título."
                  />
                ) : (
                  <TipCard text="Tem o livro em mãos? Toque em ISBN na busca e aponte para o código de barras da contracapa." />
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
      {quick.sheet}
    </FormScreen>
  );
}
