import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { ActionRow, Button, InlineMessage, SectionTitle, Text } from '../../design-system';
import { useClubs } from '../../lib/api/queries';
import { useTheme } from '../../theme';

/**
 * Book detail → reviews. Only clubs reading this exact catalog edition match, so page numbers in
 * reviews mean the same for everyone (ADR-019).
 */
export function BookClubReviews({ userId, bookId }: { userId: string; bookId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const clubs = useClubs(userId, '');
  const matches = clubs.data?.mine.filter((club) => club.book.id === bookId) ?? [];
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionTitle icon="rate-review" title="Resenhas nos seus clubes" />
      {clubs.isPending ? (
        <Text variant="bodySm" color="textMuted">
          Carregando seus clubes…
        </Text>
      ) : clubs.isError ? (
        <>
          <InlineMessage tone="error" message="Não foi possível consultar seus clubes." />
          <Button
            label="Tentar de novo"
            icon="refresh"
            variant="secondary"
            onPress={() => void clubs.refetch()}
          />
        </>
      ) : matches.length === 0 ? (
        <Text variant="bodySm" color="textMuted">
          Resenhas são publicadas em um clube que lê esta mesma edição. Entre em um ou crie o seu na
          Comunidade.
        </Text>
      ) : (
        matches.map((club) => (
          <View key={club.id} style={{ gap: theme.spacing.sm }}>
            <ActionRow
              icon="rate-review"
              title="Avaliar & resenhar"
              subtitle={`Publicar em ${club.name}`}
              onPress={() =>
                router.push({ pathname: '/nova-resenha/[clubId]', params: { clubId: club.id } })
              }
            />
            <ActionRow
              icon="forum"
              title="Ler resenhas"
              subtitle={club.name}
              onPress={() =>
                router.push({ pathname: '/clubes/[id]', params: { id: club.id, tab: 'resenhas' } })
              }
            />
          </View>
        ))
      )}
    </View>
  );
}
