import { type CatalogBook, type OnboardingRequest } from '@bubo/contracts';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import {
  BookCover,
  BuboMascot,
  Button,
  FormScreen,
  Icon,
  InlineMessage,
  LinkButton,
  Text,
} from '../../design-system';
import { Raised } from '../../design-system/Raised';
import {
  authorLine,
  editionLabel,
  catalogErrorMessage,
  scannerPick,
  useDebouncedValue,
} from '../../features/catalog/catalog';
import { ManualBookForm, type ManualBookFormHandle } from '../../features/catalog/ManualBookForm';
import { SearchField } from '../../features/catalog/SearchField';
import { type FirstBookDraft, useOnboarding } from '../../features/onboarding/OnboardingProvider';
import { ONBOARDING_TOTAL_STEPS } from '../../features/onboarding/options';
import { ApiError } from '../../lib/api/client';
import { useCatalogSearch, useCompleteOnboarding } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

function saveErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
      return 'Sem conexão com o servidor. Suas respostas continuam aqui — tente de novo.';
    }
    if (error.code === 'VALIDATION_FAILED') return 'Confira os dados do livro e tente de novo.';
    if (error.code === 'NOT_FOUND') return 'Esse livro saiu do catálogo. Escolha outro.';
  }
  return 'Não foi possível salvar agora. Tente de novo.';
}

function toDraft(book: CatalogBook): FirstBookDraft {
  return {
    title: book.title,
    author: authorLine(book),
    totalPages: book.totalPages,
    catalogId: book.catalogId,
    coverUrls: book.coverUrls,
  };
}

/** Selectable search result (Stitch: selected = purple stroke + filled "+" button). */
function PickRow({
  book,
  selected,
  onPress,
}: {
  book: CatalogBook;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const author = authorLine(book);
  const facts = [
    book.totalPages ? `${book.totalPages} páginas` : null,
    book.publishedYear,
    editionLabel(book),
  ]
    .filter(Boolean)
    .join(' • ');
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${book.title}${author ? `, de ${author}` : ''}`}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      <Raised
        faceColor={theme.colors.surface}
        borderColor={selected ? theme.colors.primary : theme.colors.borderSoft}
        rimColor={selected ? theme.colors.primary : theme.colors.cardShadow}
        radius={theme.radii.lg}
        depth={theme.sizes.cardRim}
        faceStyle={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
        }}
      >
        <BookCover title={book.title} author={author} coverUrls={book.coverUrls} width={52} />
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {book.title}
          </Text>
          {author ? (
            <Text variant="bodySm" color="textMuted" numberOfLines={1}>
              {author}
            </Text>
          ) : null}
          {facts ? (
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 2,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.primarySoft,
              }}
            >
              <Text variant="caption" color="accentText">
                {facts}
              </Text>
            </View>
          ) : null}
        </View>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.radii.md,
            borderWidth: theme.sizes.borderWidth,
            borderColor: selected ? theme.colors.primary : theme.colors.border,
            backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon
            name={selected ? 'check' : 'add'}
            size={20}
            color={selected ? 'onPrimary' : 'accentText'}
          />
        </View>
      </Raised>
    </Pressable>
  );
}

/** Onboarding 5/6 — Início da estante: catalog search, ISBN scan or manual entry. */
export default function FirstBookStep() {
  const theme = useTheme();
  const router = useRouter();
  const auth = useAuthState();
  const userId = auth.status === 'needs_onboarding' || auth.status === 'ready' ? auth.userId : '';
  const { draft, update } = useOnboarding();
  const save = useCompleteOnboarding(userId);
  const manualForm = useRef<ManualBookFormHandle>(null);

  const [text, setText] = useState('');
  const q = useDebouncedValue(text.trim());
  const results = useCatalogSearch(userId, q);
  const books = q.length >= 2 ? (results.data?.results ?? []).slice(0, 6) : [];
  const [picked, setPicked] = useState<CatalogBook | null>(null);
  const [manual, setManual] = useState(draft.firstBook !== null && !draft.firstBook.catalogId);
  const [pendingAction, setPendingAction] = useState<'book' | 'skip' | null>(null);

  // A book identified by the scanner (opened with mode=pick) becomes the selection.
  useFocusEffect(
    useCallback(() => {
      const scanned = scannerPick.take();
      if (scanned) {
        setManual(false);
        setPicked(scanned);
        setText(scanned.title);
      }
    }, []),
  );

  async function submit(firstBook: FirstBookDraft | null, action: 'book' | 'skip') {
    if (draft.readingHabit === null || draft.goals.length === 0 || draft.interests.length === 0) {
      // Defensive: a step was skipped (e.g. deep link). Go back to the start of onboarding.
      router.replace('/onboarding');
      return;
    }
    const request: OnboardingRequest['firstBook'] = !firstBook
      ? null
      : firstBook.catalogId
        ? { catalogId: firstBook.catalogId }
        : { title: firstBook.title, author: firstBook.author, totalPages: firstBook.totalPages };
    setPendingAction(action);
    try {
      const me = await save.mutateAsync({
        readingHabit: draft.readingHabit,
        goals: draft.goals,
        interests: draft.interests,
        firstBook: request,
      });
      haptics.success();
      update({ firstBook, saved: me });
      router.push('/onboarding/concluido');
    } catch {
      haptics.error();
    } finally {
      setPendingAction(null);
    }
  }

  function confirm() {
    if (manual) {
      const book = manualForm.current?.submit();
      if (book) {
        void submit(
          { title: book.title, author: book.author ?? null, totalPages: book.totalPages ?? null },
          'book',
        );
      }
      return;
    }
    if (picked) void submit(toDraft(picked), 'book');
  }

  const ctaLabel = manual
    ? 'Colocar na minha estante'
    : picked
      ? `Colocar ${picked.title.length > 22 ? 'na' : `${picked.title} na`} minha estante`
      : 'Escolha um livro';

  return (
    <FormScreen
      step={{ current: 5, total: ONBOARDING_TOTAL_STEPS }}
      footer={
        <>
          <Button
            label={ctaLabel}
            icon="check"
            fullWidth
            loading={pendingAction === 'book'}
            disabled={pendingAction !== null || (!manual && !picked)}
            onPress={confirm}
          />
          <LinkButton
            label="Pular por enquanto (adicionar depois)"
            color="textMuted"
            align="center"
            onPress={() => {
              if (pendingAction === null) void submit(null, 'skip');
            }}
          />
        </>
      }
    >
      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <BuboMascot animated pose="reading" size={56} />
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="accentText">
              Início da estante
            </Text>
            <Text variant="heading" accessibilityRole="header">
              O que você está lendo agora?
            </Text>
          </View>
        </View>
        <Text variant="body" color="textMuted">
          Adicione seu primeiro livro para começar a registrar sessões de leitura profunda e recall.
        </Text>
      </View>

      {save.isError ? <InlineMessage tone="error" message={saveErrorMessage(save.error)} /> : null}

      {manual ? (
        <>
          <ManualBookForm
            ref={manualForm}
            extended={false}
            initial={
              draft.firstBook && !draft.firstBook.catalogId
                ? {
                    title: draft.firstBook.title,
                    author: draft.firstBook.author ?? '',
                    totalPages: draft.firstBook.totalPages,
                  }
                : undefined
            }
          />
          <LinkButton label="Buscar no catálogo" align="center" onPress={() => setManual(false)} />
        </>
      ) : (
        <>
          <SearchField
            value={text}
            onChangeText={(value) => {
              setText(value);
              if (picked && value.trim() !== picked.title) setPicked(null);
            }}
            loading={q.length >= 2 && results.isFetching}
            placeholder="Buscar título ou autor…"
          />
          {q.length >= 2 && results.isPending ? (
            <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Buscando livros" />
          ) : null}
          {results.isError && q.length >= 2 ? (
            <InlineMessage tone="error" message={catalogErrorMessage(results.error)} />
          ) : null}
          {q.length >= 2 && results.isSuccess && books.length === 0 ? (
            <InlineMessage
              tone="info"
              message="Nenhum livro encontrado. Tente o nome do autor ou adicione manualmente."
            />
          ) : null}
          <View accessibilityRole="radiogroup" style={{ gap: theme.spacing.md }}>
            {picked && !books.some((book) => book.catalogId === picked.catalogId) ? (
              <PickRow book={picked} selected onPress={() => setPicked(null)} />
            ) : null}
            {books.map((book) => (
              <PickRow
                key={book.catalogId}
                book={book}
                selected={picked?.catalogId === book.catalogId}
                onPress={() => setPicked(picked?.catalogId === book.catalogId ? null : book)}
              />
            ))}
          </View>
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
              onPress={() => router.push('/scanner-isbn?mode=pick')}
            />
            <Text variant="body" color="textMuted">
              •
            </Text>
            <LinkButton label="Adicionar manual" onPress={() => setManual(true)} />
          </View>
        </>
      )}
    </FormScreen>
  );
}
