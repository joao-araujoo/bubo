import { type ClubDetail } from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import {
  BuboTip,
  Button,
  EmptyState,
  InlineMessage,
  SectionTitle,
  TabChip,
  Text,
} from '../../../design-system';
import { useClubPolls, useClubPosts, useSetReaction, useVotePoll } from '../../../lib/api/queries';
import { haptics } from '../../../lib/haptics';
import { useTheme } from '../../../theme';
import { PollCard } from '../PollCard';
import { TopicCard } from '../TopicCard';

/** Stitch "Debates & Fórum": mediation, the active poll, then the community's recent topics. */
export function ForumTab({ club, userId }: { club: ClubDetail; userId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const posts = useClubPosts(userId, club.id, true);
  const polls = useClubPolls(userId, club.id, true);
  const react = useSetReaction(userId);
  const [sort, setSort] = useState<'recent' | 'debated'>('recent');
  const activePoll = polls.data?.polls.find((poll) => poll.isOpen) ?? null;
  const vote = useVotePoll(userId, club.id);
  const [votingId, setVotingId] = useState<string | null>(null);
  const readerPage = posts.data?.readerPage ?? club.readerPage ?? 0;

  const openTopic = (postId: string, reveal = false) =>
    router.push({
      pathname: '/debates/[clubId]/[postId]',
      params: reveal ? { clubId: club.id, postId, reveal: '1' } : { clubId: club.id, postId },
    });
  const openPoll = (pollId: string, reveal = false) =>
    router.push({
      pathname: '/enquetes/[clubId]/[pollId]',
      params: reveal ? { clubId: club.id, pollId, reveal: '1' } : { clubId: club.id, pollId },
    });

  const sorted = [...(posts.data?.posts ?? [])].sort((a, b) =>
    sort === 'debated'
      ? b.replyCount - a.replyCount || Date.parse(b.createdAt) - Date.parse(a.createdAt)
      : Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );

  return (
    <>
      <BuboTip state="recallPrompt" caps={false} title="Mediação cognitiva do Bubo">
        <Text variant="bodySm">
          Tópicos além da{' '}
          <Text variant="bodySm" color="accentText">
            {`página ${readerPage}`}
          </Text>{' '}
          ficam cobertos com véu protetor para preservar suas surpresas!
        </Text>
      </BuboTip>

      {activePoll ? (
        <PollCard
          poll={activePoll}
          readerPage={readerPage}
          votingOptionId={votingId}
          onOpen={() => openPoll(activePoll.id)}
          onReveal={() => openPoll(activePoll.id, true)}
          onVote={(optionId) => {
            setVotingId(optionId);
            vote.mutate(
              { pollId: activePoll.id, optionIds: [optionId] },
              {
                onSuccess: () => haptics.success(),
                onError: () => haptics.error(),
                onSettled: () => setVotingId(null),
              },
            );
          }}
        />
      ) : null}
      {vote.isError ? <InlineMessage tone="error" message="Não foi possível votar agora." /> : null}

      <SectionTitle
        icon="forum"
        title="Tópicos recentes da comunidade"
        trailing={
          <TabChip
            role="radio"
            label={sort === 'recent' ? 'Recentes' : 'Mais debatidos'}
            icon="swap-vert"
            selected
            onPress={() => setSort(sort === 'recent' ? 'debated' : 'recent')}
          />
        }
      />

      {posts.isPending ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando debates" />
      ) : posts.isError ? (
        <View style={{ gap: theme.spacing.sm }}>
          <InlineMessage tone="error" message="Não foi possível carregar os debates." />
          <Button
            label="Tentar de novo"
            variant="secondary"
            size="md"
            icon="refresh"
            onPress={() => void posts.refetch()}
          />
        </View>
      ) : sorted.length === 0 ? (
        <EmptyState
          compact
          mascot="emptyCommunity"
          title="Nenhum debate ainda"
          description="Abra o primeiro: escolha uma ideia do livro e diga de que página ela é."
        />
      ) : (
        sorted.map((post) => (
          <TopicCard
            key={post.id}
            post={post}
            readerPage={readerPage}
            onOpen={() => openTopic(post.id)}
            onReveal={() => openTopic(post.id, true)}
            onReact={(kind, active) =>
              react.mutate({ targetType: 'post', targetId: post.id, kind, active })
            }
          />
        ))
      )}
    </>
  );
}
