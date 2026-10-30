import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  FormScreen,
  InlineMessage,
  SectionHeader,
  Text,
  Toggle,
} from '../../design-system';
import { StarRating } from '../../features/community/StarRating';
import { StoryPreview } from '../../features/replay/StoryPreview';
import { StoryStylePicker } from '../../features/replay/StoryStylePicker';
import { ApiError } from '../../lib/api/client';
import { useShelfEntry, useUpdateShelfEntry } from '../../lib/api/queries';
import { useAuthState } from '../../lib/auth/session';
import { type StoryStyle, useTheme } from '../../theme';

export default function BookStoryScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuthState();
  const userId = auth.status === 'ready' ? auth.userId : undefined;
  const entryId = typeof id === 'string' ? id : '';
  const query = useShelfEntry(userId, entryId);
  const [style, setStyle] = useState<StoryStyle>('paper');
  const rate = useUpdateShelfEntry(userId ?? '', entryId);
  const [showRating, setShowRating] = useState(true);
  const [busy, setBusy] = useState(false);
  if (!userId || query.isPending)
    return (
      <FormScreen title="Meu livro em um Story">
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando livro" />
      </FormScreen>
    );
  if (query.isError || !query.data) {
    const missing = query.error instanceof ApiError && query.error.code === 'NOT_FOUND';
    return (
      <FormScreen title="Meu livro em um Story">
        <EmptyState
          mascot={missing ? 'notFound' : 'offline'}
          title={
            missing ? 'Este livro não está na sua estante' : 'Não conseguimos preparar o Story'
          }
          description={
            missing
              ? 'Escolha um livro da sua estante para compartilhar.'
              : 'Atualize o livro para preparar uma arte com os dados atuais.'
          }
          action={
            missing ? undefined : (
              <Button
                label="Tentar novamente"
                loading={query.isFetching}
                onPress={() => void query.refetch()}
              />
            )
          }
        />
      </FormScreen>
    );
  }
  const book = query.data.entry.book;
  const saved = query.data.entry.rating;
  const rating = showRating ? saved : null;
  return (
    <FormScreen title="Meu livro em um Story">
      <StoryStylePicker value={style} onChange={setStyle} disabled={busy} />
      <Card>
        <SectionHeader title="Sua nota" icon="star-outline" />
        <StarRating
          value={saved}
          size={32}
          disabled={busy || rate.isPending}
          onChange={(next) => rate.mutate({ rating: next })}
        />
        {saved !== null ? (
          <Toggle title="Mostrar nota na arte" value={showRating} onValueChange={setShowRating} />
        ) : (
          <Text variant="bodySm" color="textMuted" align="center">
            Dê uma nota para ela aparecer na arte.
          </Text>
        )}
        {rate.isError ? (
          <InlineMessage tone="error" message="Não foi possível salvar a nota. Tente de novo." />
        ) : null}
      </Card>
      <View>
        <StoryPreview
          key={`${userId}|${entryId}|${JSON.stringify(book)}|${style}|${rating}|${query.data.entry.status}`}
          content={{ kind: 'book', book, status: query.data.entry.status, rating }}
          style={style}
          onBusy={setBusy}
        />
      </View>
    </FormScreen>
  );
}
