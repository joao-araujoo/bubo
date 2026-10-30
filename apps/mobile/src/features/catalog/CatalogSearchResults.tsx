import { type CatalogBook } from '@bubo/contracts';
import { type ReactNode, useEffect } from 'react';
import { FlatList, View } from 'react-native';

import { Button, EmptyState, InlineMessage, LinkButton, Text } from '../../design-system';
import { useTheme } from '../../theme';
import { CatalogBookRow } from './CatalogBookRow';
import { prefetchCovers } from './prefetch';

type Props = {
  books: readonly CatalogBook[];
  header: ReactNode;
  searching: boolean;
  loading: boolean;
  updating: boolean;
  error: string | null;
  partial: boolean;
  pendingId: string | null;
  entryFor: (book: CatalogBook) => string | null;
  onOpen: (book: CatalogBook) => void;
  onOpenEntry: (id: string) => void;
  /** Opens the "Adicionar à estante" sheet for this book. */
  onAdd: (book: CatalogBook) => void;
  onRetry: () => void;
  onManual: () => void;
  inset?: boolean;
};

/** Row-shaped placeholders while the first results arrive (no spinner, no fake books). */
export function SearchSkeleton() {
  const theme = useTheme();
  const bar = (width: `${number}%`, height: number) => ({
    width,
    height,
    borderRadius: height / 2,
    backgroundColor: theme.colors.surfaceMuted,
  });
  return (
    <View accessible accessibilityLabel="Buscando livros" style={{ gap: theme.spacing.sm }}>
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.sm,
            borderRadius: theme.radii.lg,
            borderWidth: 1,
            borderColor: theme.colors.borderSoft,
            backgroundColor: theme.colors.surface,
          }}
        >
          <View
            style={{
              width: 60,
              height: 90,
              borderRadius: theme.radii.sm,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          />
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            <View style={bar('85%', 14)} />
            <View style={bar('55%', 12)} />
            <View style={bar('40%', 10)} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Render only the visible results; keep search controls reachable while covers load. */
export function CatalogSearchResults(props: Props) {
  const theme = useTheme();
  useEffect(() => {
    prefetchCovers(props.books.slice(0, 8), 60);
  }, [props.books]);
  const showResults = props.searching && !props.updating;
  const empty = !props.searching ? (
    <EmptyState
      mascot="recallPrompt"
      title="Qual livro você procura?"
      description="Digite pelo menos 3 letras do título ou do autor, ou leia o código de barras (ISBN)."
    />
  ) : props.loading || props.updating ? (
    <SearchSkeleton />
  ) : props.error ? (
    <View style={{ gap: theme.spacing.md }}>
      <InlineMessage tone="error" message={props.error} />
      <Button label="Tentar de novo" icon="refresh" variant="secondary" onPress={props.onRetry} />
    </View>
  ) : (
    <EmptyState
      mascot="notFound"
      title="Nenhum livro encontrado"
      description="Tente outro título, o nome do autor ou adicione o livro manualmente."
      action={
        <Button
          label="Adicionar manualmente"
          icon="edit"
          variant="secondary"
          fullWidth
          onPress={props.onManual}
        />
      }
    />
  );
  return (
    <FlatList
      data={showResults ? props.books : []}
      keyExtractor={(book) => book.catalogId}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      initialNumToRender={7}
      maxToRenderPerBatch={6}
      windowSize={7}
      contentContainerStyle={{
        padding: props.inset === false ? 0 : theme.sizes.gutter,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.sm,
      }}
      ListHeaderComponent={
        <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.xs }}>
          {props.header}
          {showResults && !props.loading && props.books.length ? (
            <Text variant="label" color="textMuted" accessibilityLiveRegion="polite">
              {props.books.length}{' '}
              {props.books.length === 1 ? 'livro encontrado' : 'livros encontrados'}
            </Text>
          ) : null}
          {props.partial && props.books.length ? (
            <InlineMessage
              tone="info"
              message="Uma biblioteca demorou para responder. Estes resultados já estão disponíveis."
            />
          ) : null}
          {props.error && props.books.length ? (
            <InlineMessage tone="error" message={props.error} />
          ) : null}
        </View>
      }
      ListEmptyComponent={empty}
      ListFooterComponent={
        showResults && props.books.length ? (
          <View style={{ alignItems: 'center', paddingTop: theme.spacing.md }}>
            <Text variant="bodySm" color="textMuted">
              Não achou o seu livro?
            </Text>
            <LinkButton label="Adicionar manualmente" onPress={props.onManual} />
          </View>
        ) : null
      }
      renderItem={({ item, index }) => (
        <CatalogBookRow
          book={item}
          priority={index < 4 ? 'high' : 'normal'}
          onOpen={() => props.onOpen(item)}
          entryId={props.entryFor(item)}
          onOpenEntry={props.onOpenEntry}
          onAdd={() => props.onAdd(item)}
          adding={props.pendingId === item.catalogId}
          disabled={props.pendingId !== null}
        />
      )}
    />
  );
}
