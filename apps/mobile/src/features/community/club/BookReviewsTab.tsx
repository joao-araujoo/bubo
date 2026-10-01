import { type ClubDetail } from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Button, EmptyState, InlineMessage, Text } from '../../../design-system';
import { useClubBookReviews, useSetReaction } from '../../../lib/api/queries';
import { useTheme } from '../../../theme';
import { TopicCard } from '../TopicCard';

export function BookReviewsTab({ club, userId }: { club: ClubDetail; userId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const reviews = useClubBookReviews(userId, club.id);
  const reaction = useSetReaction(userId);
  const open = (postId: string, reveal = false) =>
    router.push({
      pathname: '/resenhas/[clubId]/[postId]',
      params: { clubId: club.id, postId, ...(reveal ? { reveal: '1' } : {}) },
    });
  return (
    <>
      <Text variant="bodySm" color="textMuted">
        Impressões sobre {club.book.title}, compartilhadas somente com membros deste clube. A página
        protege quem ainda está lendo.
      </Text>
      <Button
        label="Escrever resenha"
        icon="edit-note"
        onPress={() =>
          router.push({ pathname: '/nova-resenha/[clubId]', params: { clubId: club.id } })
        }
      />
      {reviews.isPending ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando resenhas" />
      ) : reviews.isError ? (
        <>
          <InlineMessage tone="error" message="Não foi possível carregar as resenhas." />
          <Button label="Tentar novamente" onPress={() => void reviews.refetch()} />
        </>
      ) : reviews.data.posts.length === 0 ? (
        <EmptyState
          mascot="emptyCommunity"
          title="O que este livro deixou em você?"
          description="Ainda não há resenhas visíveis neste clube. Compartilhe sua experiência quando quiser."
        />
      ) : (
        <>
          <Text variant="caption" color="textMuted">
            Resenhas recentes
          </Text>
          {reviews.data.posts.map((post) => (
            <TopicCard
              key={post.id}
              post={post}
              readerPage={reviews.data.readerPage}
              onOpen={() => open(post.id)}
              onReveal={() => open(post.id, true)}
              onReact={(kind, active) =>
                reaction.mutate({ targetType: 'post', targetId: post.id, kind, active })
              }
            />
          ))}
        </>
      )}
      {reaction.isError ? (
        <InlineMessage tone="error" message="Não foi possível registrar a reação." />
      ) : null}
    </>
  );
}
