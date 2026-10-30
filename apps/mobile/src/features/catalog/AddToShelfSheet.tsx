import { type CatalogBook } from '@bubo/contracts';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { BookCover, BottomSheet, Icon, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { authorLine } from './catalog';
import { ADD_SHELF_OPTIONS, type AddShelfStatus } from './ShelfStatusPicker';
import { useAddFromCatalog } from './useAddFromCatalog';

const HINTS: Record<AddShelfStatus, string> = {
  want_to_read: 'Guardar para ler depois',
  reading: 'Começar a acompanhar a leitura',
  finished: 'Registrar que você já leu',
};

function AddChoices({
  book,
  preferred,
  onPick,
}: {
  book: CatalogBook;
  preferred: AddShelfStatus;
  onPick: (status: AddShelfStatus) => void;
}) {
  const theme = useTheme();
  const author = authorLine(book);
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <BookCover title={book.title} author={author} coverUrls={book.coverUrls} width={52} />
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text variant="caption" color="accentDeep">
            Adicionar à estante
          </Text>
          <Text variant="titleSm" accessibilityRole="header" numberOfLines={2}>
            {book.title}
          </Text>
          {author ? (
            <Text variant="bodySm" color="textMuted" numberOfLines={1}>
              {author}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        {ADD_SHELF_OPTIONS.map((option) => {
          const main = option.status === preferred;
          return (
            <Pressable
              key={option.status}
              accessibilityRole="button"
              accessibilityLabel={`${option.label}: ${HINTS[option.status]}`}
              onPress={() => {
                haptics.press();
                onPick(option.status);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.md,
                minHeight: 64,
                paddingHorizontal: theme.spacing.lg,
                borderRadius: theme.radii.lg,
                borderWidth: theme.sizes.borderWidth,
                borderColor: main ? theme.colors.primary : theme.colors.borderSoft,
                backgroundColor: pressed
                  ? theme.colors.primarySoft
                  : main
                    ? theme.colors.primary
                    : theme.colors.surface,
              })}
            >
              <Icon name={option.icon} size={24} color={main ? 'onPrimary' : 'accentText'} />
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" color={main ? 'onPrimary' : 'text'}>
                  {option.label}
                </Text>
                <Text variant="bodySm" color={main ? 'onPrimary' : 'textMuted'}>
                  {HINTS[option.status]}
                </Text>
              </View>
              <Icon name="add" size={22} color={main ? 'onPrimary' : 'textMuted'} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Skoob-style "+": one tap opens the three shelves, the second adds the book there without leaving
 * the list. Render `sheet` once per screen; rows show a spinner for `pendingId`.
 */
export function useQuickAdd(userId: string, preferred: AddShelfStatus = 'want_to_read') {
  const { addToShelf, pendingId } = useAddFromCatalog(userId, 'stay');
  const [book, setBook] = useState<CatalogBook | null>(null);
  const sheet = (
    <BottomSheet
      visible={book !== null}
      onClose={() => setBook(null)}
      accessibilityLabel="Adicionar à estante"
    >
      {book ? (
        <AddChoices
          book={book}
          preferred={preferred}
          onPick={(status) => {
            setBook(null);
            void addToShelf(book, status);
          }}
        />
      ) : null}
    </BottomSheet>
  );
  return {
    open: (next: CatalogBook) => {
      haptics.selection();
      setBook(next);
    },
    sheet,
    pendingId,
  };
}
