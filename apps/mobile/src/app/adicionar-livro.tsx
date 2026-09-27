import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  Button,
  EmptyState,
  FormScreen,
  HeaderButton,
  InlineMessage,
  LinkButton,
  SelectableCard,
  Text,
} from '../design-system';
import { catalogErrorMessage, useDebouncedValue } from '../features/catalog/catalog';
import { CatalogBookRow } from '../features/catalog/CatalogBookRow';
import { ManualBookForm, type ManualBookFormHandle } from '../features/catalog/ManualBookForm';
import { SearchField } from '../features/catalog/SearchField';
import { useAddFromCatalog, useShelfLookup } from '../features/catalog/useAddFromCatalog';
import { ApiError } from '../lib/api/client';
import { useAddBook, useCatalogSearch } from '../lib/api/queries';
import { useAuthState } from '../lib/auth/session';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';

type Status = 'reading' | 'want_to_read';

function StatusPicker({ status, onChange }: { status: Status; onChange: (s: Status) => void }) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.sm }}>
      <Text variant="label">Status</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <SelectableCard
            mode="radio"
            icon="bookmark-border"
            title="Quero ler"
            selected={status === 'want_to_read'}
            onPress={() => onChange('want_to_read')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <SelectableCard
            mode="radio"
            icon="auto-stories"
            title="Estou lendo"
            selected={status === 'reading'}
            onPress={() => onChange('reading')}
          />
        </View>
      </View>
    </View>
  );
}

/** Manual entry (Stitch "Adicionar manualmente"). */
function ManualMode({ userId }: { userId: string }) {
  const router = useRouter();
  const theme = useTheme();
  const form = useRef<ManualBookFormHandle>(null);
  const add = useAddBook(userId);
  const [status, setStatus] = useState<Status>('want_to_read');
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
        onScanPress={() => router.replace('/scanner-isbn')}
      />
      <View style={{ marginTop: theme.spacing.xs }}>
        <StatusPicker status={status} onChange={setStatus} />
      </View>
    </FormScreen>
  );
}

/** Catalog search first (Google Books + Open Library), with ISBN scan and manual fallbacks. */
function SearchMode({ userId }: { userId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim());
  const results = useCatalogSearch(userId, q);
  const { addToShelf, pendingId } = useAddFromCatalog(userId, 'replace');
  const entryFor = useShelfLookup(userId);
  const books = q.length >= 2 ? (results.data?.results ?? []) : [];

  return (
    <FormScreen eyebrow="Estante inteligente" title="Adicionar livro">
      <SearchField
        value={text}
        onChangeText={setText}
        onScanPress={() => router.push('/scanner-isbn')}
        loading={q.length >= 2 && results.isFetching}
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
        <LinkButton label="Escanear ISBN" onPress={() => router.push('/scanner-isbn')} />
        <Text variant="body" color="textMuted">
          •
        </Text>
        <LinkButton label="Adicionar manual" onPress={() => router.setParams({ manual: '1' })} />
      </View>

      {q.length < 2 ? (
        <EmptyState
          mascot="recallPrompt"
          title="Qual livro você quer adicionar?"
          description="Busque pelo título, autor ou ISBN. As capas e os dados vêm do Google Books e da Open Library."
        />
      ) : results.isPending ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Buscando livros" />
      ) : results.isError ? (
        <>
          <InlineMessage tone="error" message={catalogErrorMessage(results.error)} />
          <Button
            label="Tentar de novo"
            icon="refresh"
            variant="secondary"
            onPress={() => void results.refetch()}
          />
        </>
      ) : books.length === 0 ? (
        <EmptyState
          mascot="notFound"
          title="Nenhum livro encontrado"
          description="Confira a grafia, tente o nome do autor ou adicione manualmente."
          action={
            <Button
              label="Adicionar manualmente"
              icon="edit"
              variant="secondary"
              fullWidth
              onPress={() => router.setParams({ manual: '1' })}
            />
          }
        />
      ) : (
        books.map((book) => {
          const entryId = entryFor(book);
          return (
            <CatalogBookRow
              key={book.catalogId}
              book={book}
              onOpen={() =>
                router.push({ pathname: '/catalogo/[id]', params: { id: book.catalogId } })
              }
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
        })
      )}
    </FormScreen>
  );
}

export default function AddBookScreen() {
  const auth = useAuthState();
  const { manual } = useLocalSearchParams<{ manual?: string }>();
  const userId = auth.status === 'ready' ? auth.userId : '';
  return manual === '1' ? <ManualMode userId={userId} /> : <SearchMode userId={userId} />;
}
