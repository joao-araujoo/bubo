import { type CatalogBook } from '@bubo/contracts';
import { type ComponentProps } from 'react';
import { Pressable, View } from 'react-native';

import { BookCover, Button, Card, Chip, type Icon, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { authorLine, editionLabel } from './catalog';

type Action = {
  label: string;
  icon?: ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success';
};

type Props = {
  book: CatalogBook;
  onOpen?: () => void;
  action?: Action;
  /** Replaces the action, e.g. "Na estante". */
  badge?: string;
};

/** Stitch "Comunidade está lendo" row: cover, title, author, two-line synopsis, facts and CTA. */
export function CatalogBookRow({ book, onOpen, action, badge }: Props) {
  const theme = useTheme();
  const author = authorLine(book);
  const facts = [
    book.totalPages ? `${book.totalPages} págs.` : null,
    book.publishedYear ? String(book.publishedYear) : null,
    book.publisher,
    editionLabel(book),
  ].filter((fact): fact is string => fact !== null);

  const body = (
    <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
      <BookCover title={book.title} author={author} coverUrls={book.coverUrls} width={76} />
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text variant="titleSm" numberOfLines={2}>
          {book.title}
        </Text>
        {author ? (
          <Text variant="bodySm" color="textMuted" numberOfLines={1}>
            {author}
          </Text>
        ) : null}
        {book.description ? (
          <Text variant="bodySm" color="textMuted" numberOfLines={2} style={{ marginTop: 2 }}>
            {book.description}
          </Text>
        ) : book.subtitle ? (
          <Text variant="bodySm" color="textMuted" numberOfLines={2} style={{ marginTop: 2 }}>
            {book.subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <Card style={{ gap: theme.spacing.md }}>
      {onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${book.title}${author ? `, de ${author}` : ''}`}
          accessibilityHint="Abre os detalhes do livro"
          onPress={() => {
            haptics.selection();
            onOpen();
          }}
        >
          {body}
        </Pressable>
      ) : (
        body
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, flex: 1 }}>
          {facts.map((fact) => (
            <Chip key={fact} label={fact} tone="primary" />
          ))}
        </View>
        {badge ? (
          <Chip label={badge} tone="success" icon="check" />
        ) : action ? (
          <Button
            size="md"
            label={action.label}
            icon={action.icon}
            variant={action.variant ?? 'primary'}
            loading={action.loading}
            disabled={action.disabled}
            onPress={action.onPress}
          />
        ) : null}
      </View>
    </Card>
  );
}
