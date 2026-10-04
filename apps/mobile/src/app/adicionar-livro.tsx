import { MIN_CATALOG_QUERY_LENGTH } from '@bubo/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  FormScreen,
  HeaderButton,
  InlineMessage,
  LinkButton,
  Text,
} from '../design-system';
import { catalogErrorMessage, useDebouncedValue } from '../features/catalog/catalog';
import { CatalogSearchResults } from '../features/catalog/CatalogSearchResults';
import { ManualBookForm, type ManualBookFormHandle } from '../features/catalog/ManualBookForm';
import { SearchField } from '../features/catalog/SearchField';
import { ShelfStatusPicker, type AddShelfStatus } from '../features/catalog/ShelfStatusPicker';
import { useAddFromCatalog, useShelfLookup } from '../features/catalog/useAddFromCatalog';
import { ApiError } from '../lib/api/client';
import { useAddBook, useCatalogSearch } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

/** Manual entry (Stitch "Adicionar manualmente"). */
function ManualMode({ userId, initialStatus }: { userId: string; initialStatus: AddShelfStatus }) {
  const router = useRouter();
  const theme = useTheme();
  const form = useRef<ManualBookFormHandle>(null);
  const add = useAddBook(userId);
  const [status, setStatus] = useState<AddShelfStatus>(initialStatus);
  const [formError, setFormError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function save() {
    setFormError(null);
    const book = form.current?.submit();
    if (!book) return;
    try {
      const entry = await add.mutateAsync({ ...book, status });
      haptics.success();
      router.replace({ pathname: '/livro/[id]', params: { id: entry.id } });
    } catch (error) {
      haptics.error();
      setFormError(
        error instanceof ApiError && error.code === 'VALIDATION_FAILED'
          ? 'Confira os campos e tente de novo.'
          : catalogErrorMessage(error),
      );
    }
  }

  return (
    <FormScreen
      eyebrow="Estante inteligente"
      title="Adicionar manualmente"
      headerRight={
        <HeaderButton
          icon="restart-alt"
          label="Limpar formulário"
          onPress={() => {
            haptics.press();
            setFormKey((key) => key + 1);
          }}
        />
      }
      footer={
        <Button
          label="Salvar livro na estante"
          icon="bookmark-add"
          fullWidth
          loading={add.isPending}
          onPress={() => void save()}
        />
      }
    >
      {formError ? <InlineMessage tone="error" message={formError} /> : null}
      <ManualBookForm
        key={formKey}
        ref={form}
        onScanPress={() => router.replace({ pathname: '/scanner-isbn', params: { status } })}
      />
      <View style={{ marginTop: theme.spacing.xs }}>
        <ShelfStatusPicker status={status} onChange={setStatus} disabled={add.isPending} />
      </View>
    </FormScreen>
  );
}

/** Catalog search first (Google Books + Open Library), with ISBN scan and manual fallbacks. */
function SearchMode({ userId, initialStatus }: { userId: string; initialStatus: AddShelfStatus }) {
  const theme = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<AddShelfStatus>(initialStatus);
  const q = useDebouncedValue(text.trim());
  const results = useCatalogSearch(userId, q);
  const { addToShelf, pendingId } = useAddFromCatalog(userId, 'stay');
  const entryFor = useShelfLookup(userId);
  const books = q.length >= MIN_CATALOG_QUERY_LENGTH ? (results.data?.results ?? []) : [];

  return (
    <FormScreen
      eyebrow="Sua coleção de leituras"
      title="Adicionar livros"
      scroll={false}
      footer={
        <Button
          label="Ver minha estante"
          variant="secondary"
          icon="menu-book"
          fullWidth
          onPress={() => router.replace('/(tabs)/estante')}
        />
      }
    >
      <CatalogSearchResults
        books={books}
        searching={text.trim().length >= MIN_CATALOG_QUERY_LENGTH}
        loading={results.isPending}
        updating={text.trim() !== q}
        error={results.isError ? catalogErrorMessage(results.error) : null}
        partial={Object.values(results.data?.sources ?? {}).includes('error')}
        pendingId={pendingId}
        entryFor={entryFor}
        onOpen={(book) =>
          router.push({ pathname: '/catalogo/[id]', params: { id: book.catalogId, status } })
        }
        onOpenEntry={(id) => router.push({ pathname: '/livro/[id]', params: { id } })}
        onAdd={(book) => void addToShelf(book, status)}
        onRetry={() => void results.refetch()}
        onManual={() => router.setParams({ manual: '1', status })}
        header={
          <>
            <SearchField
              value={text}
              onChangeText={setText}
              onScanPress={() => router.push({ pathname: '/scanner-isbn', params: { status } })}
              loading={
                text.trim().length >= MIN_CATALOG_QUERY_LENGTH &&
                (text.trim() !== q || results.isFetching)
              }
              autoFocus
            />
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: theme.spacing.md,
              }}
            >
              <LinkButton
                label="Escanear ISBN"
                onPress={() => router.push({ pathname: '/scanner-isbn', params: { status } })}
              />
              <Text variant="body" color="textMuted">
                •
              </Text>
              <LinkButton
                label="Adicionar manual"
                onPress={() => router.setParams({ manual: '1', status })}
              />
            </View>
            <ShelfStatusPicker status={status} onChange={setStatus} disabled={pendingId !== null} />
            <Text variant="caption" color="textMuted">
              Confira idioma e edição antes de adicionar. Você pode adicionar vários livros sem sair
              da busca.
            </Text>
          </>
        }
      />
    </FormScreen>
  );
}

export default function AddBookScreen() {
  const auth = useAuthState();
  const { manual, status } = useLocalSearchParams<{ manual?: string; status?: string }>();
  const userId = auth.status === 'ready' ? auth.userId : '';
  const initialStatus = status === 'finished' || status === 'reading' ? status : 'want_to_read';
  return manual === '1' ? (
    <ManualMode userId={userId} initialStatus={initialStatus} />
  ) : (
    <SearchMode userId={userId} initialStatus={initialStatus} />
  );
}
