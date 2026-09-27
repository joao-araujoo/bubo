import { type CatalogBook } from '@bubo/contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import {
  BookCover,
  Button,
  Card,
  Chip,
  EmptyState,
  FormScreen,
  Icon,
  InlineMessage,
  Text,
} from '../../design-system';
import { authorLine, catalogErrorMessage } from '../../features/catalog/catalog';
import { useAddFromCatalog } from '../../features/catalog/useAddFromCatalog';
import { ApiError } from '../../lib/api/client';
import { useCatalogBook } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { useTheme } from '../../theme';

const LANGUAGES: Record<string, string> = {
  pt: 'Português',
  'pt-BR': 'Português',
  'pt-PT': 'Português (PT)',
  en: 'Inglês',
  es: 'Espanhol',
  fr: 'Francês',
  de: 'Alemão',
  it: 'Italiano',
};

const SOURCE_LABELS: Record<CatalogBook['sources'][number], string> = {
  google: 'Google Books',
  openlibrary: 'Open Library',
};

function formatIsbn(isbn: string) {
  return isbn.length === 13
    ? `${isbn.slice(0, 3)}-${isbn.slice(3, 5)}-${isbn.slice(5, 9)}-${isbn.slice(9, 12)}-${isbn.slice(12)}`
    : isbn;
}

function BookDetails({ book }: { book: CatalogBook }) {
  const theme = useTheme();
  const author = authorLine(book);
  const facts = [
    book.totalPages ? `${book.totalPages} páginas` : null,
    book.publishedYear ? String(book.publishedYear) : null,
    book.language ? (LANGUAGES[book.language] ?? book.language.toUpperCase()) : null,
  ].filter((fact): fact is string => fact !== null);

  return (
    <>
      <Card tone="muted" style={{ alignItems: 'center', paddingVertical: theme.spacing.xl }}>
        <BookCover title={book.title} author={author} coverUrls={book.coverUrls} width={168} />
      </Card>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="heading" accessibilityRole="header">
          {book.title}
        </Text>
        {book.subtitle ? (
          <Text variant="bodyLg" color="textMuted">
            {book.subtitle}
          </Text>
        ) : null}
        <Text variant="body" color="accentText">
          {[author, book.publisher].filter(Boolean).join(' · ') || 'Autor desconhecido'}
        </Text>
      </View>
      {facts.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {facts.map((fact) => (
            <Chip key={fact} label={fact} tone="primary" />
          ))}
        </View>
      ) : null}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Icon name="notes" size={20} color="accentText" />
          <Text variant="caption" color="textMuted" accessibilityRole="header">
            Sinopse
          </Text>
        </View>
        <Text variant="body" color={book.description ? 'text' : 'textMuted'}>
          {book.description ?? 'As bibliotecas consultadas ainda não têm sinopse para este livro.'}
        </Text>
      </Card>
      <Text variant="bodySm" color="textMuted" align="center">
        {book.isbn13 ? `ISBN ${formatIsbn(book.isbn13)} · ` : ''}Dados de{' '}
        {book.sources.map((source) => SOURCE_LABELS[source]).join(' e ')}
      </Text>
    </>
  );
}

/** Catalog book preview: cover, facts and synopsis, then "Quero ler" / "Estou lendo". */
export default function CatalogBookScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const query = useCatalogBook(userId, id);
  const { addToShelf, pendingId } = useAddFromCatalog(userId);
  const book = query.data?.book;
  const entryId = query.data?.shelfEntryId ?? null;

  const footer = book ? (
    entryId ? (
      <Button
        label="Abrir na estante"
        icon="menu-book"
        fullWidth
        onPress={() => router.replace({ pathname: '/livro/[id]', params: { id: entryId } })}
      />
    ) : (
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button
          label="Quero ler"
          icon="bookmark-border"
          variant="secondary"
          style={{ flex: 1 }}
          disabled={pendingId !== null}
          onPress={() => void addToShelf(book, 'want_to_read')}
        />
        <Button
          label="Estou lendo"
          icon="auto-stories"
          style={{ flex: 1 }}
          loading={pendingId !== null}
          onPress={() => void addToShelf(book, 'reading')}
        />
      </View>
    )
  ) : undefined;

  return (
    <FormScreen footer={footer}>
      {query.isPending ? (
        <ActivityIndicator
          color={theme.colors.primary}
          style={{ marginTop: theme.spacing.xxxl }}
          accessibilityLabel="Carregando livro"
        />
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
                onPress={() => router.replace('/adicionar-livro?manual=1')}
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
      ) : book ? (
        <BookDetails book={book} />
      ) : null}
    </FormScreen>
  );
}
