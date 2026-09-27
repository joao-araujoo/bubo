import { type CatalogBook } from '@bubo/contracts';
import { type Genre } from '@bubo/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from 'react-native';

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
import {
  authorLine,
  catalogErrorMessage,
  GENRE_QUERIES,
  useDebouncedValue,
} from '../features/catalog/catalog';
import { CatalogBookRow } from '../features/catalog/CatalogBookRow';
import { SearchField } from '../features/catalog/SearchField';
import { useAddFromCatalog, useShelfLookup } from '../features/catalog/useAddFromCatalog';
import { GENRE_OPTIONS } from '../features/onboarding/options';
import { useCatalogSearch } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

type Topic = 'for_you' | Genre;
const NO_INTERESTS: readonly Genre[] = [];

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
          minHeight: 44,
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

function SectionTitle({ title, trailing }: { title: string; trailing?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View
        style={{ width: 6, height: 22, borderRadius: 3, backgroundColor: theme.colors.primary }}
      />
      <Text variant="title" accessibilityRole="header" style={{ flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      {trailing ? (
        <Text variant="bodySm" color="textMuted">
          {trailing}
        </Text>
      ) : null}
    </View>
  );
}

/** "Em alta no Bubo" style card: big cover, title, author and a "+ Estante" button. */
function FeaturedCard({
  book,
  onOpen,
  onAdd,
  adding,
  onShelf,
}: {
  book: CatalogBook;
  onOpen: () => void;
  onAdd: () => void;
  adding: boolean;
  onShelf: boolean;
}) {
  const theme = useTheme();
  const author = authorLine(book);
  return (
    <View style={{ width: 176, gap: theme.spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${book.title}${author ? `, de ${author}` : ''}`}
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
          width={176}
          height={240}
        />
        <View>
          <Text variant="bodyStrong" numberOfLines={1}>
            {book.title}
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={1}>
            {author ?? 'Autor desconhecido'}
          </Text>
        </View>
      </Pressable>
      <Button
        size="md"
        variant="secondary"
        icon={onShelf ? 'check' : 'bookmark-add'}
        label={onShelf ? 'Na estante' : 'Estante'}
        loading={adding}
        disabled={onShelf}
        onPress={onAdd}
      />
    </View>
  );
}

/** Descobrir livros: catalog search (Google Books + Open Library), topics and ISBN scanner. */
export default function DiscoverScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const interests = auth.status === 'ready' ? auth.me.profile.interests : NO_INTERESTS;

  const [text, setText] = useState(params.q ?? '');
  const [topic, setTopic] = useState<Topic>('for_you');
  const typed = useDebouncedValue(text.trim());
  const searching = typed.length >= 2;

  const topics = useMemo(() => {
    const ordered = [
      ...GENRE_OPTIONS.filter((genre) => interests.includes(genre.id)),
      ...GENRE_OPTIONS.filter((genre) => !interests.includes(genre.id)),
    ];
    return ordered;
  }, [interests]);

  const topicGenre: Genre = topic === 'for_you' ? (interests[0] ?? 'fantasy') : topic;
  const topicLabel =
    topic === 'for_you'
      ? 'Para você'
      : (GENRE_OPTIONS.find((genre) => genre.id === topic)?.title ?? '');

  const results = useCatalogSearch(userId, searching ? typed : GENRE_QUERIES[topicGenre]);
  const books = results.data?.results ?? [];
  const partial =
    results.data?.sources.google === 'error' || results.data?.sources.openlibrary === 'error';

  const { addToShelf, pendingId } = useAddFromCatalog(userId);
  const shelfEntryFor = useShelfLookup(userId);

  const open = (book: CatalogBook) =>
    router.push({ pathname: '/catalogo/[id]', params: { id: book.catalogId } });
  const scan = () => router.push('/scanner-isbn');

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

  const status = results.isPending ? (
    <ActivityIndicator
      color={theme.colors.primary}
      style={{ marginVertical: theme.spacing.xl }}
      accessibilityLabel="Carregando livros"
    />
  ) : results.isError ? (
    <View style={{ gap: theme.spacing.md }}>
      <InlineMessage tone="error" message={catalogErrorMessage(results.error)} />
      <Button
        label="Tentar de novo"
        icon="refresh"
        variant="secondary"
        size="md"
        onPress={() => void results.refetch()}
      />
    </View>
  ) : null;

  return (
    <Screen header={<Header />}>
      <SearchField
        value={text}
        onChangeText={setText}
        onScanPress={scan}
        loading={searching && results.isFetching}
      />

      {!searching ? (
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
      ) : null}

      {partial ? (
        <InlineMessage
          tone="info"
          message="Uma das bibliotecas não respondeu. Mostrando resultados parciais."
        />
      ) : null}

      {searching ? (
        <>
          <SectionTitle
            title="Resultados"
            trailing={results.data ? `${books.length} livros` : undefined}
          />
          {status}
          {results.isSuccess && books.length === 0 ? (
            <EmptyState
              mascot="notFound"
              title="Nenhum livro encontrado"
              description="Tente outro título, o nome do autor ou leia o ISBN na contracapa."
              action={
                <Button
                  label="Adicionar manualmente"
                  icon="edit"
                  variant="secondary"
                  fullWidth
                  onPress={() => router.push('/adicionar-livro?manual=1')}
                />
              }
            />
          ) : null}
          {books.map(rowFor)}
        </>
      ) : (
        <>
          <SectionTitle title={topicLabel} />
          {status}
          {books.length > 0 ? (
            <FlatList
              horizontal
              data={books.slice(0, 8)}
              keyExtractor={(book) => book.catalogId}
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -theme.sizes.gutter }}
              contentContainerStyle={{
                gap: theme.spacing.lg,
                paddingHorizontal: theme.sizes.gutter,
              }}
              renderItem={({ item }) => (
                <FeaturedCard
                  book={item}
                  onOpen={() => open(item)}
                  onAdd={() => void addToShelf(item)}
                  adding={pendingId === item.catalogId}
                  onShelf={shelfEntryFor(item) !== null}
                />
              )}
            />
          ) : null}

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
                <Text variant="bodySm">
                  Tem o livro em mãos? Toque em ISBN e aponte para o código de barras da contracapa.
                </Text>
              </View>
            </View>
          </Card>

          {books.length > 8 ? (
            <>
              <SectionTitle title={`Mais em ${topicLabel.toLowerCase()}`} />
              {books.slice(8).map(rowFor)}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}
