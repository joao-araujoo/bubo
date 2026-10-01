import { useRouter } from 'expo-router';
import { Button, Card, InlineMessage, SectionHeader, Text } from '../../design-system';
import { useClubs } from '../../lib/api/queries';

/** Only clubs with the exact catalog edition; manual or unrelated books never match. */
export function BookClubReviews({ userId, bookId }: { userId: string; bookId: string }) {
  const router = useRouter();
  const clubs = useClubs(userId, '');
  const matches = clubs.data?.mine.filter((club) => club.book.id === bookId) ?? [];
  return (
    <Card>
      <SectionHeader title="Resenhas nos seus clubes" icon="edit-note" />
      {clubs.isPending ? (
        <Text variant="bodySm">Carregando seus clubes…</Text>
      ) : clubs.isError ? (
        <>
          <InlineMessage tone="error" message="Não foi possível consultar seus clubes." />
          <Button
            label="Tentar novamente"
            variant="secondary"
            onPress={() => void clubs.refetch()}
          />
        </>
      ) : matches.length === 0 ? (
        <Text variant="bodySm" color="textMuted">
          Entre em um clube que lê esta edição para compartilhar sua resenha. Suas reflexões
          pessoais continuam nas sessões.
        </Text>
      ) : (
        matches.map((club) => (
          <Button
            key={club.id}
            label={`Resenhas em ${club.name}`}
            variant="secondary"
            onPress={() =>
              router.push({ pathname: '/clubes/[id]', params: { id: club.id, tab: 'resenhas' } })
            }
          />
        ))
      )}
    </Card>
  );
}
