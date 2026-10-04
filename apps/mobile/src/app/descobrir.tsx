import { type CatalogBook, type DiscoverItem, type DiscoverSection } from '@bubo/contracts';
import { type Genre, MIN_CATALOG_QUERY_LENGTH } from '@bubo/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';

import {
  BookCover,
  BuboLogo,
  BuboMascot,
  Button,
  Card,
  EmptyState,
  Icon,
  InlineMessage,
  Screen,
  Text,
} from '../design-system';
import { Raised } from '../design-system/Raised';
import { authorLine, catalogErrorMessage, useDebouncedValue } from '../features/catalog/catalog';
import { CatalogBookRow } from '../features/catalog/CatalogBookRow';
import { CatalogSearchResults } from '../features/catalog/CatalogSearchResults';
import { prefetchCovers } from '../features/catalog/prefetch';
import { SearchField } from '../features/catalog/SearchField';
import { ShelfStatusPicker, type AddShelfStatus } from '../features/catalog/ShelfStatusPicker';
import { useAddFromCatalog, useShelfLookup } from '../features/catalog/useAddFromCatalog';
import { GENRE_OPTIONS } from '../features/onboarding/options';
import { useCatalogDiscover, useCatalogSearch } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

type Topic = 'for_you' | Genre;
const NO_INTERESTS: readonly Genre[] = [];

const LARGE = { width: 176, height: 240 } as const;
const COMPACT = { width: 132, height: 192 } as const;
type CardSize = typeof LARGE | typeof COMPACT;

const ISBN_TIP =
  'Tem o livro em mãos? Toque em ISBN e aponte para o código de barras da contracapa.';

function Header() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        onPress={() => router.back()}
        hitSlop={4}
      >
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.borderSoft}
          rimColor={theme.colors.cardShadow}
          radius={theme.radii.lg}
          depth={3}
          faceStyle={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}
        >
          <BuboLogo variant="symbol" height={26} />
        </Raised>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text variant="heading" accessibilityRole="header">
          Descobrir livros
        </Text>
        <Text variant="caption" color="accentText">
          Explorar acervo
        </Text>
      </View>
    </View>
  );
}

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
    >
      <Raised
        faceColor={selected ? theme.colors.primary : theme.colors.surface}
        borderColor={selected ? theme.colors.primary : theme.colors.border}
        rimColor={selected ? theme.colors.primaryRim : theme.colors.secondaryRim}
        radius={theme.radii.lg}
        depth={3}
        faceStyle={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
          minHeight: 48,
          paddingHorizontal: theme.spacing.lg,
        }}
      >
        {icon ? <Icon name={icon} size={18} color={selected ? 'onPrimary' : 'accentText'} /> : null}
        <Text variant="label" color={selected ? 'onPrimary' : 'text'}>
          {label}
        </Text>
      </Raised>
    </Pressable>
  );
}

function SectionTitle({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string | null;
  trailing?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{ width: 6, height: 22, borderRadius: 3, backgroundColor: theme.colors.primary }}
        />
        <Text variant="title" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={2}>
          {title}
        </Text>
        {trailing ? (
          <Text variant="bodySm" color="textMuted">
            {trailing}
          </Text>
        ) : null}
      </View>
      {subtitle ? (
        <Text variant="bodySm" color="textMuted" style={{ marginLeft: 6 + theme.spacing.sm }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/** Skoob-style shelf card: cover, title, author, why it is here and a "+ Estante" button. */
function FeaturedCard({
  item,
  size,
  priority,
  onOpen,
  onAdd,
  adding,
  onShelf,
  disabled,
}: {
  item: DiscoverItem;
  size: CardSize;
  priority: boolean;
  onOpen: () => void;
  onAdd: () => void;
  adding: boolean;
  onShelf: boolean;
  disabled: boolean;
}) {
  const theme = useTheme();
  const { book } = item;
  const author = authorLine(book);
  const note = item.readers ? `${item.readers} leitores no Bubo` : item.reason;
  return (
    <View style={{ width: size.width, gap: theme.spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${book.title}${author ? `, de ${author}` : ''}${note ? `. ${note}` : ''}`}
        accessibilityHint="Abre os detalhes do livro"
        onPress={() => {
          haptics.selection();
          onOpen();
        }}
        style={{ gap: theme.spacing.sm }}
      >
        <BookCover
          title={book.title}
          author={author}
          coverUrls={book.coverUrls}
          width={size.width}
          height={size.height}
          priority={priority ? 'high' : 'normal'}
        />
        <View style={{ gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {book.title}
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={1}>
            {author ?? 'Autor desconhecido'}
          </Text>
          {note ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.xxs, marginTop: 2 }}>
              <Icon name={item.readers ? 'groups' : 'auto-awesome'} size={14} color="accentText" />
              <Text variant="caption" color="accentText" numberOfLines={2} style={{ flex: 1 }}>
                {note}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Button
        size="md"
        variant="secondary"
        icon={onShelf ? 'check' : 'bookmark-add'}
        label={onShelf ? 'Na estante' : 'Estante'}
        loading={adding}
        disabled={disabled && !onShelf}
        onPress={onAdd}
      />
    </View>
  );
}

/** Cover-shaped placeholders while a shelf loads (no spinner, no fake books). */
function ShelfSkeleton({ size }: { size: CardSize }) {
  const theme = useTheme();
  const bar = (width: number, height: number) => ({
    width,
    height,
    borderRadius: height / 2,
    backgroundColor: theme.colors.surfaceMuted,
  });
  return (
    <View
      accessible
      accessibilityLabel="Carregando livros"
      style={{ flexDirection: 'row', gap: theme.spacing.lg, overflow: 'hidden' }}
    >
      {[0, 1, 2].map((index) => (
        <View key={index} style={{ width: size.width, gap: theme.spacing.sm }}>
          <View
            style={{
              width: size.width,
              height: size.height,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          />
          <View style={bar(size.width * 0.8, 14)} />
          <View style={bar(size.width * 0.5, 12)} />
        </View>
      ))}
    </View>
  );
}

function BuboTipCard({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <Card tone="muted">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BuboMascot pose="takingNotes" size={88} />
        <View
          style={{
            flex: 1,
            gap: theme.spacing.xs,
            padding: theme.spacing.md,
            borderRadius: theme.radii.lg,
            borderWidth: theme.sizes.borderWidth,
            borderColor: theme.colors.borderSoft,
            backgroundColor: theme.colors.surface,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Icon name="lightbulb-outline" size={16} color="accentText" />
            <Text variant="caption" color="accentText">
              Dica do Bubo
            </Text>
          </View>
          <Text variant="bodySm">{text}</Text>
        </View>
      </View>
    </Card>
  );
}

/** Descobrir livros: search, Skoob-style recommendation shelves (ADR-031) and ISBN scanner. */
export default function DiscoverScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const interests = auth.status === 'ready' ? auth.me.profile.interests : NO_INTERESTS;

  const [text, setText] = useState(params.q ?? '');
  const [topic, setTopic] = useState<Topic>('for_you');
  const [status, setStatus] = useState<AddShelfStatus>('want_to_read');
  const typed = useDebouncedValue(text.trim());
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

  // Warm the image cache as soon as books arrive, before their cards scroll into view.
  useEffect(() => {
    if (books.length) prefetchCovers(books.slice(0, 6), 76);
  }, [books]);
  useEffect(() => {
    sections.forEach((section, index) =>
      prefetchCovers(
        section.items.slice(0, 8).map((entry) => entry.book),
        index === 0 ? LARGE.width : COMPACT.width,
      ),
    );
  }, [sections]);

  const { addToShelf, pendingId } = useAddFromCatalog(userId, 'stay');
  const shelfEntryFor = useShelfLookup(userId);

  const open = (book: CatalogBook) =>
    router.push({ pathname: '/catalogo/[id]', params: { id: book.catalogId, status } });
  const scan = () => router.push({ pathname: '/scanner-isbn', params: { status } });

  const rowFor = (book: CatalogBook) => {
    const entryId = shelfEntryFor(book);
    return (
      <CatalogBookRow
        key={book.catalogId}
        book={book}
        onOpen={() => open(book)}
        badge={entryId ? 'Na estante' : undefined}
        action={{
          label: 'Adicionar',
          icon: 'add',
          loading: pendingId === book.catalogId,
          disabled: pendingId !== null,
          onPress: () => void addToShelf(book),
        }}
      />
    );
  };

  const shelf = (section: DiscoverSection, size: CardSize, max = 15) => (
    <View style={{ gap: theme.spacing.md }}>
      <SectionTitle title={section.title} subtitle={section.subtitle} />
      <FlatList
        horizontal
        data={section.items.slice(0, max)}
        keyExtractor={(entry) => entry.book.catalogId}
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -theme.sizes.gutter }}
        contentContainerStyle={{ gap: theme.spacing.lg, paddingHorizontal: theme.sizes.gutter }}
        initialNumToRender={4}
        renderItem={({ item, index }) => (
          <FeaturedCard
            item={item}
            size={size}
            priority={index < 3}
            onOpen={() => open(item.book)}
            onAdd={() => {
              const entryId = shelfEntryFor(item.book);
              if (entryId) router.push({ pathname: '/livro/[id]', params: { id: entryId } });
              else void addToShelf(item.book);
            }}
            adding={pendingId === item.book.catalogId}
            onShelf={shelfEntryFor(item.book) !== null}
            disabled={pendingId !== null}
          />
        )}
      />
    </View>
  );

  const retry = (message: string, onPress: () => void) => (
    <View style={{ gap: theme.spacing.md }}>
      <InlineMessage tone="error" message={message} />
      <Button
        label="Tentar de novo"
        icon="refresh"
        variant="secondary"
        size="md"
        onPress={onPress}
      />
    </View>
  );

  const basedOn = discover.data?.basedOn;
  const coldStart =
    topic === 'for_you' && basedOn !== undefined && basedOn.books === 0 && basedOn.interests === 0;
  const genreSection = topic === 'for_you' ? null : (sections[0] ?? null);
  const empty = !sections.length || (genreSection !== null && !genreSection.items.length);

  return (
    <Screen header={<Header />} scroll={false}>
      <SearchField
        value={text}
        onChangeText={setText}
        onScanPress={scan}
        loading={searching && (text.trim() !== typed || results.isFetching)}
      />
      {searching ? (
        <>
          <ShelfStatusPicker status={status} onChange={setStatus} disabled={pendingId !== null} />
          <CatalogSearchResults
            inset={false}
            books={books}
            searching
            loading={results.isPending}
            updating={text.trim() !== typed}
            error={results.isError ? catalogErrorMessage(results.error) : null}
            partial={partial}
            pendingId={pendingId}
            entryFor={shelfEntryFor}
            onOpen={open}
            onOpenEntry={(id) => router.push({ pathname: '/livro/[id]', params: { id } })}
            onAdd={(book) => void addToShelf(book, status)}
            onRetry={() => void results.refetch()}
            onManual={() =>
              router.push({ pathname: '/adicionar-livro', params: { manual: '1', status } })
            }
            header={null}
          />
        </>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.lg }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            accessibilityRole="tablist"
            style={{ marginHorizontal: -theme.sizes.gutter }}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingHorizontal: theme.sizes.gutter }}
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
              <SectionTitle title={topic === 'for_you' ? 'Para você' : 'Mais lidos'} />
              <ShelfSkeleton size={LARGE} />
              <ShelfSkeleton size={COMPACT} />
            </>
          ) : discover.isError ? (
            retry(catalogErrorMessage(discover.error), () => void discover.refetch())
          ) : (
            <>
              {discover.data.sources.openlibrary === 'error' && !sections.length ? (
                <InlineMessage
                  tone="info"
                  message="A biblioteca de livros não respondeu agora. Tente de novo em instantes."
                />
              ) : null}
              {coldStart ? (
                <BuboTipCard text="Adicione livros à sua estante e o Bubo passa a recomendar leituras parecidas com as suas." />
              ) : null}
              {genreSection ? (
                <>
                  {shelf(genreSection, LARGE, 8)}
                  <BuboTipCard text={ISBN_TIP} />
                  {genreSection.items.length > 8 ? (
                    <>
                      <SectionTitle title="Mais nessa prateleira" />
                      {genreSection.items.slice(8).map((entry) => rowFor(entry.book))}
                    </>
                  ) : null}
                </>
              ) : (
                sections.map((section, index) => (
                  <View key={section.id} style={{ gap: theme.spacing.lg }}>
                    {shelf(section, index === 0 ? LARGE : COMPACT)}
                    {index === 0 ? <BuboTipCard text={ISBN_TIP} /> : null}
                  </View>
                ))
              )}
              {empty ? (
                <EmptyState
                  mascot="notFound"
                  title="Nada por aqui ainda"
                  description="Não encontramos livros para essa prateleira agora. Tente outro gênero ou busque pelo título."
                />
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}
