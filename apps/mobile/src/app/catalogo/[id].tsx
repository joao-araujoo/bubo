import { type CatalogBook } from '@bubo/contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, EmptyState, FormScreen, InlineMessage, Text } from '../../design-system';
import { BookFacts, BookHero, Synopsis } from '../../features/book/BookHero';
import {
  authorLine,
  catalogErrorMessage,
  editionLabel,
  languageLabel,
} from '../../features/catalog/catalog';
import { useAddFromCatalog } from '../../features/catalog/useAddFromCatalog';
import { ADD_SHELF_OPTIONS, type AddShelfStatus } from '../../features/catalog/ShelfStatusPicker';
import { ApiError } from '../../lib/api/client';
import { useCatalogBook } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { useTheme } from '../../theme';

const SOURCE_LABELS: Record<CatalogBook['sources'][number], string> = {
  google: 'Google Books',
  openlibrary: 'Open Library',
  brasilapi: 'BrasilAPI',
};

function formatIsbn(isbn: string) {
  return isbn.length === 13
    ? `${isbn.slice(0, 3)}-${isbn.slice(3, 5)}-${isbn.slice(5, 9)}-${isbn.slice(9, 12)}-${isbn.slice(12)}`
    : isbn;
}

/** Cover-shaped placeholder while a book that no list knew yet loads. */
function BookSkeleton() {
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
      accessibilityLabel="Carregando livro"
      style={{ alignItems: 'center', gap: theme.spacing.md, paddingTop: theme.spacing.xl }}
    >
      <View
        style={{
          width: 150,
          height: 225,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      />
      <View style={bar(220, 22)} />
      <View style={bar(140, 16)} />
      <View style={{ ...bar(320, 64), borderRadius: theme.radii.lg }} />
    </View>
  );
}

function BookDetails({ book }: { book: CatalogBook }) {
  const theme = useTheme();
  const language = languageLabel(book);
  const facts = [
    book.totalPages ? { label: 'Páginas', value: String(book.totalPages) } : null,
    book.publishedYear ? { label: 'Ano', value: String(book.publishedYear) } : null,
    language ? { label: 'Idioma', value: language } : null,
  ].filter((fact) => fact !== null);
  const edition = [
    book.publisher ? `Editora ${book.publisher}` : null,
    book.isbn13 ? `ISBN ${formatIsbn(book.isbn13)}` : null,
  ].filter(Boolean);

  return (
    <>
      <BookHero
        title={book.title}
        subtitle={book.subtitle}
        author={authorLine(book)}
        coverUrls={book.coverUrls}
        totalPages={book.totalPages}
      />
      <BookFacts facts={facts} />
      <Synopsis text={book.description} />
      <View
        style={{
          gap: theme.spacing.xxs,
          padding: theme.spacing.md,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <Text variant="label">Edição</Text>
        {edition.length ? (
          <Text variant="bodySm" color="textMuted">
            {edition.join(' · ')}
          </Text>
        ) : null}
        <Text variant="bodySm" color="textMuted">
          {editionLabel(book)}
        </Text>
        <Text variant="bodySm" color="textMuted">
          Dados de {book.sources.map((source) => SOURCE_LABELS[source]).join(' e ')}
        </Text>
      </View>
    </>
  );
}

/** Catalog book page: hero, facts and synopsis, then one tap per shelf to add it. */
export default function CatalogBookScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id = '', status: requestedStatus } = useLocalSearchParams<{
    id: string;
    status?: string;
  }>();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const query = useCatalogBook(userId, id);
  const { addToShelf, pendingId } = useAddFromCatalog(userId, 'replace');
  const [chosen, setChosen] = useState<AddShelfStatus | null>(null);
  const preferred: AddShelfStatus =
    requestedStatus === 'finished' || requestedStatus === 'reading'
      ? requestedStatus
      : 'want_to_read';
  const canUseBook = !query.isError || (query.error instanceof ApiError && query.error.retryable);
  const book = canUseBook ? query.data?.book : undefined;
  const entryId = query.data?.shelfEntryId ?? null;

  const footer = book ? (
    entryId ? (
      <Button
        label="Abrir na minha estante"
        icon="menu-book"
        fullWidth
        onPress={() => router.replace({ pathname: '/livro/[id]', params: { id: entryId } })}
      />
    ) : (
      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="label" color="textMuted" align="center">
          Adicionar à estante como
        </Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {ADD_SHELF_OPTIONS.map((option) => (
            <Button
              key={option.status}
              label={option.label}
              size="md"
              compact
              variant={option.status === preferred ? 'primary' : 'secondary'}
              loading={pendingId !== null && option.status === chosen}
              disabled={pendingId !== null}
              accessibilityLabel={`Adicionar à estante como ${option.label}`}
              onPress={() => {
                setChosen(option.status);
                void addToShelf(book, option.status);
              }}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </View>
    )
  ) : undefined;

  return (
    <FormScreen footer={footer}>
      {book ? (
        <>
          {query.isError ? (
            <View style={{ gap: theme.spacing.sm }}>
              <InlineMessage
                tone="error"
                message="Os dados salvos estão disponíveis, mas não conseguimos atualizar este livro agora."
              />
              <Button
                label="Tentar atualizar"
                icon="refresh"
                variant="secondary"
                size="md"
                loading={query.isFetching}
                onPress={() => void query.refetch()}
              />
            </View>
          ) : null}
          <BookDetails book={book} />
        </>
      ) : query.isPending ? (
        <BookSkeleton />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.code === 'NOT_FOUND' ? (
          <EmptyState
            mascot="notFound"
            title="Livro não encontrado"
            description="Esse livro não está mais disponível no catálogo. Você pode adicioná-lo manualmente."
            action={
              <Button
                label="Adicionar manualmente"
                icon="edit"
                variant="secondary"
                fullWidth
                onPress={() =>
                  router.replace({
                    pathname: '/adicionar-livro',
                    params: { manual: '1', status: preferred },
                  })
                }
              />
            }
          />
        ) : (
          <>
            <InlineMessage tone="error" message={catalogErrorMessage(query.error)} />
            <Button
              label="Tentar de novo"
              icon="refresh"
              variant="secondary"
              onPress={() => void query.refetch()}
            />
          </>
        )
      ) : null}
    </FormScreen>
  );
}
