import { type ShelfEntry } from '@bubo/contracts';
import { readingProgress } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import {
  BookCover,
  Button,
  Card,
  Chip,
  EmptyState,
  InlineMessage,
  ProgressBar,
  Text,
} from '../../design-system';
import { useShelf } from '../../lib/api/queries';
import { useTheme } from '../../theme';

function ReadingBook({ entry }: { entry: ShelfEntry }) {
  const theme = useTheme();
  const router = useRouter();
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
          {progress.currentPage > 0 ? `Você está na página ${progress.currentPage}. ` : ''}Informe o
          total de páginas em “Atualizar” para ver sua porcentagem.
        </Text>
      )}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button
          label="Continuar leitura"
          icon="play-arrow"
          size="md"
          compact
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/sessao/[id]', params: { id: entry.id } })}
        />
        <Button
          label="Atualizar"
          icon="add"
          variant="secondary"
          size="md"
          compact
          accessibilityHint="Atualiza a página atual ou o status do livro"
          onPress={() => router.push({ pathname: '/livro/[id]', params: { id: entry.id } })}
        />
      </View>
    </>
  );
}

export function ReadingNowSection({ userId }: { userId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const shelf = useShelf(userId);
  const reading = shelf.data?.entries.find((entry) => entry.status === 'reading');

  return (
    <Card>
      <Chip label="Lendo agora" tone="primary" eyebrow />
      {shelf.isPending ? (
        <ActivityIndicator
          color={theme.colors.primary}
          accessibilityLabel="Carregando sua estante"
        />
      ) : shelf.isError ? (
        <>
          <InlineMessage tone="error" message="Não foi possível carregar sua estante agora." />
          <Button
            label="Tentar de novo"
            variant="secondary"
            size="md"
            icon="refresh"
            onPress={() => void shelf.refetch()}
          />
        </>
      ) : reading ? (
        <ReadingBook entry={reading} />
      ) : (
        <>
          <EmptyState
            compact
            mascot="emptyShelf"
            title="Nenhum livro em leitura"
            description="Adicione o livro que você está lendo para acompanhar o progresso e revisar o que ficou."
          />
          <Button
            label="Ir para a Estante"
            icon="menu-book"
            fullWidth
            onPress={() => router.navigate('/estante')}
          />
        </>
      )}
    </Card>
  );
}
