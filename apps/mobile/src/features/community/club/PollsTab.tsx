import { type ClubDetail, type ClubPoll } from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { BuboTip, EmptyState, InlineMessage, SectionTitle } from '../../../design-system';
import { useClubPolls, useVotePoll } from '../../../lib/api/queries';
import { haptics } from '../../../lib/haptics';
import { useTheme } from '../../../theme';
import { PollCard } from '../PollCard';

/** Stitch "Enquetes": open polls first (vote inline), then closed ones with final results. */
export function PollsTab({ club, userId }: { club: ClubDetail; userId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const polls = useClubPolls(userId, club.id, true);
  const voting = useVotePoll(userId, club.id);
  const [votingId, setVotingId] = useState<string | null>(null);
  const readerPage = polls.data?.readerPage ?? club.readerPage ?? 0;

  const open = (poll: ClubPoll, reveal = false) =>
    router.push({
      pathname: '/enquetes/[clubId]/[pollId]',
      params: reveal
        ? { clubId: club.id, pollId: poll.id, reveal: '1' }
        : { clubId: club.id, pollId: poll.id },
    });

  function vote(poll: ClubPoll, optionId: string) {
    setVotingId(optionId);
    voting.mutate(
      { pollId: poll.id, optionIds: [optionId] },
      {
        onSuccess: () => haptics.success(),
        onError: () => haptics.error(),
        onSettled: () => setVotingId(null),
      },
    );
  }

  const list = polls.data?.polls ?? [];
  const openPolls = list.filter((poll) => poll.isOpen);
  const closed = list.filter((poll) => !poll.isOpen);

  const card = (poll: ClubPoll) => (
    <PollCard
      key={poll.id}
      poll={poll}
      readerPage={readerPage}
      votingOptionId={votingId}
      onOpen={() => open(poll)}
      onReveal={() => open(poll, true)}
      onVote={(optionId) => vote(poll, optionId)}
    />
  );

  return (
    <>
      <BuboTip state="reviewDue" title="Estímulo reflexivo">
        Enquetes dividem opiniões e levam o clube a debater o sentido da obra. Os resultados
        aparecem depois do seu voto, para ninguém seguir a maioria.
      </BuboTip>
      {voting.isError ? (
        <InlineMessage tone="error" message="Não foi possível votar agora." />
      ) : null}
      {polls.isPending ? (
        <ActivityIndicator color={theme.colors.primary} accessibilityLabel="Carregando enquetes" />
      ) : polls.isError ? (
        <InlineMessage tone="error" message="Não foi possível carregar as enquetes." />
      ) : list.length === 0 ? (
        <EmptyState
          compact
          mascot="emptyCommunity"
          title="Nenhuma enquete ainda"
          description="Faça uma pergunta que divida opiniões sobre o livro: 2 a 4 respostas, por 3 ou 7 dias."
        />
      ) : (
        <>
          {openPolls.length > 0 ? (
            <SectionTitle icon="how-to-vote" title="Enquetes abertas" />
          ) : null}
          {openPolls.map(card)}
          {closed.length > 0 ? <SectionTitle icon="history" title="Encerradas" /> : null}
          {closed.map(card)}
        </>
      )}
    </>
  );
}
