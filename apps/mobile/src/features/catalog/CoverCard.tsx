import { type CatalogBook } from '@bubo/contracts';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { BookCover, Icon, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { authorLine } from './catalog';

type Props = {
  book: CatalogBook;
  width: number;
  /** Why the book is here ("12 leitores no Bubo", "Porque você leu Duna"). */
  note?: string | null;
  noteIcon?: 'groups' | 'auto-awesome';
  priority?: 'low' | 'normal' | 'high';
  entryId: string | null;
  adding: boolean;
  disabled: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onOpenEntry: (entryId: string) => void;
};

/**
 * Discover carousel card (Skoob "vitrine"): the cover does the talking, with a round "+" on its
 * corner to add without leaving the shelf, then title, author and the real reason it is shown.
 */
export function CoverCard({
  book,
  width,
  note,
  noteIcon = 'auto-awesome',
  priority = 'normal',
  entryId,
  adding,
  disabled,
  onOpen,
  onAdd,
  onOpenEntry,
}: Props) {
  const theme = useTheme();
  const author = authorLine(book);
  const onShelf = entryId !== null;
  const button = 40;
  return (
    <View style={{ width, gap: theme.spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${book.title}${author ? `, de ${author}` : ''}${note ? `. ${note}` : ''}`}
        accessibilityHint="Abre os detalhes do livro"
        onPress={() => {
          haptics.selection();
          onOpen();
        }}
        style={({ pressed }) => ({ gap: theme.spacing.xs, opacity: pressed ? 0.85 : 1 })}
      >
        <BookCover
          title={book.title}
          author={author}
          coverUrls={book.coverUrls}
          width={width}
          priority={priority}
        />
        <View style={{ gap: 2, paddingRight: theme.spacing.xxs }}>
          <Text variant="bodyStrong" numberOfLines={2} style={{ fontSize: 14, lineHeight: 19 }}>
            {book.title}
          </Text>
          <Text variant="bodySm" color="textMuted" numberOfLines={1}>
            {author ?? 'Autor desconhecido'}
          </Text>
          {note ? (
            <View style={{ flexDirection: 'row', gap: theme.spacing.xxs, marginTop: 2 }}>
              <Icon name={noteIcon} size={13} color="accentText" />
              <Text variant="labelSm" color="accentText" numberOfLines={2} style={{ flex: 1 }}>
                {note}
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
        hitSlop={4}
        onPress={() => {
          if (entryId) {
            haptics.selection();
            onOpenEntry(entryId);
          } else onAdd();
        }}
        style={({ pressed }) => ({
          position: 'absolute',
          top: Math.round(width * 1.5) - button - theme.spacing.xs,
          right: theme.spacing.xs,
          width: button,
          height: button,
          borderRadius: theme.radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: theme.sizes.borderWidth,
          borderColor: theme.colors.surface,
          backgroundColor: onShelf
            ? theme.colors.success
            : pressed
              ? theme.colors.primaryPressed
              : theme.colors.primary,
          opacity: disabled && !onShelf && !adding ? 0.6 : 1,
        })}
      >
        {adding ? (
          <ActivityIndicator color={theme.colors.onPrimary} />
        ) : (
          <Icon name={onShelf ? 'check' : 'add'} size={22} color="onPrimary" />
        )}
      </Pressable>
    </View>
  );
}

/** Cover-shaped placeholders while a carousel loads (no spinner, no fake books). */
export function CoverCarouselSkeleton({ width }: { width: number }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel="Carregando livros"
      style={{ flexDirection: 'row', gap: theme.spacing.md, overflow: 'hidden' }}
    >
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={{ width, gap: theme.spacing.sm }}>
          <View
            style={{
              width,
              height: Math.round(width * 1.5),
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          />
          <View
            style={{
              width: width * 0.85,
              height: 12,
              borderRadius: 6,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          />
          <View
            style={{
              width: width * 0.55,
              height: 10,
              borderRadius: 5,
              backgroundColor: theme.colors.surfaceMuted,
            }}
          />
        </View>
      ))}
    </View>
  );
}
