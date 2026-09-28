import { type ClubSummary } from '@bubo/contracts';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Card, Chip, Icon, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { ClubBadge } from './ClubBadge';
import { membersLabel, topicsLabel } from './meta';

/** One club in the Comunidade lists: badge, name, book and real counts. */
export function ClubCard({ club }: { club: ClubSummary }) {
  const theme = useTheme();
  const router = useRouter();
  const book = club.book.author ? `${club.book.title} · ${club.book.author}` : club.book.title;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Clube ${club.name}. Livro: ${book}. ${membersLabel(club.memberCount)}, ${topicsLabel(club.topicCount)}.`}
      accessibilityHint="Abre o clube"
      onPress={() => {
        haptics.selection();
        router.push({ pathname: '/clubes/[id]', params: { id: club.id } });
      }}
    >
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <ClubBadge icon={club.icon} />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="titleSm" numberOfLines={2}>
              {club.name}
            </Text>
            <Text variant="bodySm" color="textMuted" numberOfLines={1}>
              {book}
            </Text>
          </View>
          <Icon name="chevron-right" size={24} color="textMuted" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Chip label={membersLabel(club.memberCount)} tone="neutral" icon="group" />
          <Chip label={topicsLabel(club.topicCount)} tone="neutral" icon="forum" />
          {club.membership === 'owner' ? (
            <Chip label="Você criou" tone="primary" icon="star-outline" />
          ) : club.membership === 'member' ? (
            <Chip label="Membro" tone="primary" icon="check" />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
