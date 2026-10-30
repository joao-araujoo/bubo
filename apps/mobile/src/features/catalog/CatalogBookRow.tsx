import { type CatalogBook } from '@bubo/contracts';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { BookCover, Icon, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { authorLine, languageLabel } from './catalog';

type Props = {
  book: CatalogBook;
  onOpen: () => void;
  /** The reader's shelf entry for this book, when it is already on the shelf. */
  entryId: string | null;
  onOpenEntry: (entryId: string) => void;
  /** Opens the "Adicionar à estante" sheet. */
  onAdd: () => void;
  adding?: boolean;
  disabled?: boolean;
  priority?: 'low' | 'normal' | 'high';
};

/**
 * Skoob-style search result: a compact row (cover, title, author, year · pages · language) that
 * opens the book, and a round "+" that adds it without leaving the list. Books already on the
 * shelf show a check that opens them instead.
 */
export function CatalogBookRow({
  book,
  onOpen,
  entryId,
  onOpenEntry,
  onAdd,
  adding = false,
  disabled = false,
  priority = 'normal',
}: Props) {
  const theme = useTheme();
  const author = authorLine(book);
  const meta = [
    book.publishedYear ? String(book.publishedYear) : null,
    book.totalPages ? `${book.totalPages} págs.` : null,
    languageLabel(book),
  ]
    .filter(Boolean)
    .join(' · ');
  const onShelf = entryId !== null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.borderSoft,
        backgroundColor: theme.colors.surface,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${book.title}${author ? `, de ${author}` : ''}${onShelf ? ', na sua estante' : ''}`}
        accessibilityHint="Abre os detalhes do livro"
        onPress={() => {
          haptics.selection();
          onOpen();
        }}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <BookCover
          title={book.title}
          author={author}
          coverUrls={book.coverUrls}
          width={60}
          priority={priority}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {book.title}
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={1}>
            {author ?? 'Autor desconhecido'}
          </Text>
          {meta ? (
            <Text variant="meta" color="textMuted" numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          {onShelf ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.xxs,
                marginTop: 2,
              }}
            >
              <Icon name="check-circle" size={14} color="successText" />
              <Text variant="labelSm" color="successText">
                Na sua estante
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={onShelf ? `Abrir ${book.title} na estante` : `Adicionar ${book.title}`}
        accessibilityState={{ disabled: disabled && !onShelf, busy: adding }}
        disabled={(disabled && !onShelf) || adding}
        onPress={() => {
          if (entryId) {
            haptics.selection();
            onOpenEntry(entryId);
          } else onAdd();
        }}
        style={({ pressed }) => ({
          width: theme.sizes.touchTarget,
          height: theme.sizes.touchTarget,
          borderRadius: theme.radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: onShelf
            ? theme.colors.successSoft
            : pressed
              ? theme.colors.primaryPressed
              : theme.colors.primary,
          opacity: disabled && !onShelf && !adding ? 0.5 : 1,
        })}
      >
        {adding ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : (
          <Icon
            name={onShelf ? 'check' : 'add'}
            size={26}
            color={onShelf ? 'successText' : 'onPrimary'}
          />
        )}
      </Pressable>
    </View>
  );
}
