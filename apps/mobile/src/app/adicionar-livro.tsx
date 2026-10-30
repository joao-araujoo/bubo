import { MIN_CATALOG_QUERY_LENGTH } from '@bubo/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, FormScreen, HeaderButton, Icon, InlineMessage, Text } from '../design-system';
import { useQuickAdd } from '../features/catalog/AddToShelfSheet';
import { catalogErrorMessage, useDebouncedValue } from '../features/catalog/catalog';
import { CatalogSearchResults } from '../features/catalog/CatalogSearchResults';
import { ManualBookForm, type ManualBookFormHandle } from '../features/catalog/ManualBookForm';
import { SearchField } from '../features/catalog/SearchField';
import { ShelfStatusPicker, type AddShelfStatus } from '../features/catalog/ShelfStatusPicker';
import { useShelfLookup } from '../features/catalog/useAddFromCatalog';
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

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: 'qr-code-scanner' | 'edit-note';
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptics.press();
        onPress();
      }}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
        minHeight: theme.sizes.touchTarget,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radii.lg,
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.borderSoft,
        backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surface,
      })}
    >
      <Icon name={icon} size={20} color="accentText" />
      <Text variant="label" color="text">
        {label}
      </Text>
    </Pressable>
  );
}

/** Catalog search first (Google Books + Open Library), with ISBN scan and manual fallbacks. */
function SearchMode({ userId, initialStatus }: { userId: string; initialStatus: AddShelfStatus }) {
  const theme = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim(), 300);
  const results = useCatalogSearch(userId, q);
  const quick = useQuickAdd(userId, initialStatus);
  const entryFor = useShelfLookup(userId);
  const searching = text.trim().length >= MIN_CATALOG_QUERY_LENGTH;
  const books = q.length >= MIN_CATALOG_QUERY_LENGTH ? (results.data?.results ?? []) : [];
  const scan = () => router.push({ pathname: '/scanner-isbn', params: { status: initialStatus } });
  const manual = () => router.setParams({ manual: '1', status: initialStatus });

  return (
    <FormScreen title="Adicionar livro" scroll={false}>
      <CatalogSearchResults
        books={books}
        searching={searching}
        loading={results.isPending}
        updating={text.trim() !== q && !results.data}
        error={results.isError ? catalogErrorMessage(results.error) : null}
        partial={Object.values(results.data?.sources ?? {}).includes('error')}
        pendingId={quick.pendingId}
        entryFor={entryFor}
        onOpen={(book) =>
          router.push({
            pathname: '/catalogo/[id]',
            params: { id: book.catalogId, status: initialStatus },
          })
        }
        onOpenEntry={(id) => router.push({ pathname: '/livro/[id]', params: { id } })}
        onAdd={quick.open}
        onRetry={() => void results.refetch()}
        onManual={manual}
        header={
          <>
            <SearchField
              value={text}
              onChangeText={setText}
              onScanPress={scan}
              placeholder="Título, autor ou ISBN"
              loading={searching && (text.trim() !== q || results.isFetching)}
              autoFocus
            />
            {searching ? null : (
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <QuickAction icon="qr-code-scanner" label="Ler ISBN" onPress={scan} />
                <QuickAction icon="edit-note" label="Cadastrar à mão" onPress={manual} />
              </View>
            )}
          </>
        }
      />
      {quick.sheet}
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
