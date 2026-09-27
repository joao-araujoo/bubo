import { type NewBook, newBookSchema } from '@bubo/contracts';
import { MAX_BOOK_PAGES, toIsbn13 } from '@bubo/domain';
import { forwardRef, type ReactNode, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import {
  BookCover,
  BuboMascot,
  Card,
  Icon,
  LinkButton,
  Text,
  TextField,
} from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';

export type ManualBookFormHandle = {
  /** Validates and returns the book, or null (errors are shown inline). */
  submit: () => NewBook | null;
};

type Props = {
  initial?: Partial<{ title: string; author: string; totalPages: number | null }>;
  /** "Escanear código" next to the ISBN field. */
  onScanPress?: () => void;
  /** Extended fields (publisher, year, ISBN). Onboarding keeps the short form. */
  extended?: boolean;
};

function Label({ text, trailing }: { text: string; trailing?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text variant="label">{text}</Text>
      {trailing}
    </View>
  );
}

/** −10 / +10 page stepper around a numeric input (Stitch "Total de páginas"). */
function PagesStepper({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const theme = useTheme();
  const step = (delta: number) => {
    haptics.selection();
    const current = /^\d+$/.test(value) ? Number(value) : 0;
    const next = Math.min(MAX_BOOK_PAGES, Math.max(1, current + delta));
    onChange(String(next));
  };
  const StepButton = ({ delta }: { delta: number }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={delta > 0 ? 'Mais 10 páginas' : 'Menos 10 páginas'}
      onPress={() => step(delta)}
      style={({ pressed }) => ({
        width: theme.sizes.touchTarget,
        height: theme.sizes.touchTarget,
        borderRadius: theme.radii.md,
        borderWidth: theme.sizes.borderWidth,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.primarySoft : theme.colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <Text variant="labelLg" color="accentText">
        {delta > 0 ? '+10' : '−10'}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          padding: theme.spacing.sm,
          borderRadius: theme.radii.lg,
          borderWidth: theme.sizes.borderWidth,
          borderColor: error ? theme.colors.error : theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}
      >
        <StepButton delta={-10} />
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'center',
          }}
        >
          <TextInput
            value={value}
            onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 5))}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor={theme.colors.textMuted}
            accessibilityLabel="Total de páginas"
            maxFontSizeMultiplier={1.4}
            style={[
              theme.typography.title,
              { color: theme.colors.text, minWidth: 48, textAlign: 'center', padding: 0 },
            ]}
          />
          <Text variant="body" color="textMuted">
            páginas
          </Text>
        </View>
        <StepButton delta={10} />
      </View>
      {error ? (
        <Text variant="bodySm" color="error" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Manual book form after Stitch "Adicionar manualmente": Bubo tip, live typographic cover,
 * title, author, page stepper and (extended) publisher, year and ISBN.
 */
export const ManualBookForm = forwardRef<ManualBookFormHandle, Props>(function ManualBookForm(
  { initial, onScanPress, extended = true },
  ref,
) {
  const theme = useTheme();
  const authorRef = useRef<TextInput>(null);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [author, setAuthor] = useState(initial?.author ?? '');
  const [pages, setPages] = useState(initial?.totalPages ? String(initial.totalPages) : '');
  const [publisher, setPublisher] = useState('');
  const [year, setYear] = useState('');
  const [isbn, setIsbn] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useImperativeHandle(ref, () => ({
    submit() {
      const next: Record<string, string> = {};
      const pageCount = pages.trim() === '' ? null : Number(pages);
      if (pageCount !== null && (pageCount < 1 || pageCount > MAX_BOOK_PAGES)) {
        next.totalPages = `Informe um número entre 1 e ${MAX_BOOK_PAGES}.`;
      }
      const yearValue = year.trim() === '' ? null : Number(year);
      if (
        yearValue !== null &&
        (!Number.isInteger(yearValue) || yearValue < 1 || yearValue > 2100)
      ) {
        next.publishedYear = 'Informe um ano válido.';
      }
      if (isbn.trim() !== '' && !toIsbn13(isbn)) next.isbn = 'ISBN inválido (10 ou 13 dígitos).';
      const parsed = newBookSchema.safeParse({
        title,
        author: author.trim() === '' ? null : author,
        totalPages: pageCount,
        ...(extended
          ? {
              publisher: publisher.trim() === '' ? null : publisher,
              publishedYear: yearValue,
              isbn: isbn.trim() === '' ? null : isbn,
            }
          : {}),
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0]);
          if (key === 'title') next.title ??= 'Informe o título do livro.';
          if (key === 'author') next.author ??= 'Use até 200 caracteres.';
          if (key === 'publisher') next.publisher ??= 'Use até 200 caracteres.';
        }
      }
      setErrors(next);
      if (!parsed.success || Object.keys(next).length > 0) {
        haptics.warning();
        return null;
      }
      return parsed.data;
    },
  }));

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <BuboMascot pose="takingNotes" size={64} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Icon name="tips-and-updates" size={16} color="accentText" />
              <Text variant="label" color="accentText">
                Dica do Bubo
              </Text>
            </View>
            <Text variant="bodySm">
              Preencha os dados do livro para que o Bubo acompanhe seu progresso e suas revisões.
            </Text>
          </View>
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
          <BookCover
            title={title.trim() || 'Seu livro'}
            author={author.trim() || null}
            width={80}
          />
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="label">Capa do livro</Text>
            <Text variant="bodySm" color="textMuted">
              {extended
                ? 'Com o ISBN, o Bubo busca a capa original. Sem ele, usamos esta capa com o título.'
                : 'O Bubo monta uma capa com o título e o autor.'}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ gap: theme.spacing.xs }}>
        <Label
          text="Título do livro *"
          trailing={
            <Text variant="bodySm" color="accentText">
              Obrigatório
            </Text>
          }
        />
        <TextField
          label="Título do livro"
          icon="menu-book"
          placeholder="Ex.: Flores para Algernon"
          value={title}
          onChangeText={setTitle}
          error={errors.title}
          returnKeyType="next"
          onSubmitEditing={() => authorRef.current?.focus()}
          hideLabel
        />
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        <Label text="Autor ou autora" />
        <TextField
          ref={authorRef}
          label="Autor ou autora"
          icon="person-outline"
          placeholder="Ex.: Daniel Keyes"
          value={author}
          onChangeText={setAuthor}
          error={errors.author}
          autoComplete="off"
          hideLabel
        />
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        <Label
          text="Total de páginas"
          trailing={
            <Text variant="bodySm" color="textMuted">
              Mostra seu progresso
            </Text>
          }
        />
        <PagesStepper value={pages} onChange={setPages} error={errors.totalPages} />
      </View>
      {extended ? (
        <>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Label text="Editora" />
              <TextField
                label="Editora"
                placeholder="Ex.: Aleph"
                value={publisher}
                onChangeText={setPublisher}
                error={errors.publisher}
                hideLabel
              />
            </View>
            <View style={{ flex: 1, gap: theme.spacing.xs }}>
              <Label text="Ano da edição" />
              <TextField
                label="Ano da edição"
                placeholder="Ex.: 2018"
                value={year}
                onChangeText={(text) => setYear(text.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                error={errors.publishedYear}
                hideLabel
              />
            </View>
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            <Label
              text="ISBN (opcional)"
              trailing={
                onScanPress ? <LinkButton label="Escanear código" onPress={onScanPress} /> : null
              }
            />
            <TextField
              label="ISBN"
              placeholder="978-85-7657-388-3"
              value={isbn}
              onChangeText={setIsbn}
              keyboardType="number-pad"
              error={errors.isbn}
              hideLabel
            />
          </View>
        </>
      ) : null}
    </View>
  );
});
