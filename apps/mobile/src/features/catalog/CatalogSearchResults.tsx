import { type CatalogBook } from '@bubo/contracts';
import { type ReactNode, useEffect } from 'react';
import { FlatList, View } from 'react-native';

import { Button, EmptyState, InlineMessage, Text } from '../../design-system';
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
  onAdd: (book: CatalogBook) => void;
  onRetry: () => void;
  onManual: () => void;
  inset?: boolean;
};

/** Render only the visible results; keep search controls reachable while covers load. */
export function CatalogSearchResults(props: Props) {
  const theme = useTheme();
  useEffect(() => {
    prefetchCovers(props.books.slice(0, 6), 76);
  }, [props.books]);
  const empty = !props.searching ? (
    <EmptyState
      mascot="recallPrompt"
      title="Qual livro você quer adicionar?"
      description="Digite pelo menos 3 caracteres do título ou autor, ou busque pelo ISBN."
    />
  ) : props.loading || props.updating ? (
    <View accessible accessibilityLabel="Buscando livros" style={{ gap: theme.spacing.md }}>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={{
            height: 150,
            borderRadius: theme.radii.lg,
            backgroundColor: theme.colors.surfaceMuted,
          }}
        />
      ))}
    </View>
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
      data={props.searching && !props.updating ? props.books : []}
      keyExtractor={(book) => book.catalogId}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={5}
      contentContainerStyle={{
        padding: props.inset === false ? 0 : theme.sizes.gutter,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.md,
      }}
      ListHeaderComponent={
        <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.sm }}>
          {props.header}
          {props.searching && !props.updating && !props.loading ? (
            <Text variant="bodySm" color="textMuted" accessibilityLiveRegion="polite">
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
      renderItem={({ item, index }) => {
        const entryId = props.entryFor(item);
        return (
          <CatalogBookRow
            book={item}
            priority={index < 3 ? 'high' : 'normal'}
            onOpen={() => props.onOpen(item)}
            action={{
              label: entryId ? 'Abrir estante' : 'Adicionar',
              icon: entryId ? 'check' : 'bookmark-add',
              variant: entryId ? 'secondary' : 'primary',
              loading: props.pendingId === item.catalogId,
              disabled: props.pendingId !== null,
              onPress: () => (entryId ? props.onOpenEntry(entryId) : props.onAdd(item)),
            }}
          />
        );
      }}
    />
  );
}
