import { type ShelfEntry } from '@bubo/contracts';
import { readingProgress } from '@bubo/domain';
import { View } from 'react-native';

import { BookCover, ProgressBar, Text } from '../../design-system';
import { useTheme } from '../../theme';

/** Current book context without a competing primary action. */
export function ReadingBookSummary({ entry }: { entry: ShelfEntry }) {
  const theme = useTheme();
  const progress = readingProgress(entry.currentPage, entry.book.totalPages ?? 0);
  return (
    <>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
        <BookCover
          title={entry.book.title}
          author={entry.book.author}
          coverUrls={entry.book.coverUrls}
          width={80}
        />
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text variant="title" numberOfLines={2}>
            {entry.book.title}
          </Text>
          {entry.book.author ? (
            <Text variant="body" color="textMuted" numberOfLines={1}>
              {entry.book.author}
            </Text>
          ) : null}
        </View>
      </View>
      {progress.totalPages > 0 ? (
        <View style={{ gap: theme.spacing.xs }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="label" color="accentText">
              {progress.percent}%
            </Text>
            <Text variant="bodySm" color="textMuted">
              Pág. {progress.currentPage} de {progress.totalPages}
            </Text>
          </View>
          <ProgressBar
            percent={progress.percent}
            accessibilityLabel={`Progresso de leitura: ${progress.percent}%`}
          />
        </View>
      ) : (
        <Text variant="bodySm" color="textMuted">
          Você está na página {progress.currentPage}.
        </Text>
      )}
    </>
  );
}
