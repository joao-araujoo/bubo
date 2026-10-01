import { type ClubDetail } from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { BuboTip, Button, InlineMessage, SectionTitle, Text } from '../../../design-system';
import { useClubBookReviews, useSetReaction } from '../../../lib/api/queries';
import { useTheme } from '../../../theme';
import { TopicCard } from '../TopicCard';

/** Club "Resenhas" tab: reviews of the shared book, spoiler-locked by page like every topic. */
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

  if (reviews.isPending)
    return (
      <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando resenhas" />
    );
  if (reviews.isError)
    return (
      <>
        <InlineMessage tone="error" message="Não foi possível carregar as resenhas." />
        <Button label="Tentar de novo" icon="refresh" onPress={() => void reviews.refetch()} />
      </>
    );
  if (reviews.data.posts.length === 0)
    return (
      <BuboTip pose="takingNotes" title="O que este livro deixou em você?" titleIcon="rate-review">
        <Text variant="bodySm">
          {`Ainda não há resenhas de ${club.book.title} que você possa ver. Escreva a primeira: dê sua nota, conte o que ficou e marque a página se falar do desfecho.`}
        </Text>
      </BuboTip>
    );
  return (
    <>
      <SectionTitle
        icon="rate-review"
        title="Resenhas do clube"
        subtitle="Só para membros. Quem ainda não chegou à página vê o véu."
      />
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
      {reaction.isError ? (
        <InlineMessage tone="error" message="Não foi possível registrar a reação." />
      ) : null}
    </>
  );
}
