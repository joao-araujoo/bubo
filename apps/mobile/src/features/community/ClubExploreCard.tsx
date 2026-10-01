import { type ClubSummary } from '@bubo/contracts';
import { View } from 'react-native';

import { BookCover, Button, Icon, Pill, Raised, Text } from '../../design-system';
import { useTheme } from '../../theme';
import { ClubBadge } from './ClubBadge';
import { membersLabel, topicsLabel } from './meta';

/**
 * Stitch "Explorar clubes" card: badge, name, curator and members, the club book on a lavender
 * sub-card (weekly goal, "Na sua página!"), status pills and the two actions.
 */
export function ClubExploreCard({
  club,
  onOpen,
  onJoin,
  joining = false,
  highlight,
}: {
  club: ClubSummary;
  onOpen: () => void;
  onJoin?: () => void;
  joining?: boolean;
  /** Corner ribbon, e.g. "NA SUA ESTANTE". */
  highlight?: string;
}) {
  const theme = useTheme();
  const member = club.membership !== null;
  return (
    <Raised
      faceColor={theme.colors.surface}
      borderColor={highlight ? theme.colors.purpleLight : theme.colors.borderSoft}
      rimColor={highlight ? theme.colors.primarySoft : theme.colors.cardShadow}
      radius={22}
      depth={theme.sizes.cardRim}
      faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, overflow: 'hidden' }}
    >
      {highlight ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 4,
            borderBottomLeftRadius: theme.radii.md,
            backgroundColor: theme.colors.primary,
          }}
        >
          <Icon name="bolt" size={13} color="onPrimary" />
          <Text variant="caption" color="onPrimary">
            {highlight}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
        <ClubBadge icon={club.icon} size={52} />
        <View style={{ flex: 1, gap: 2, paddingRight: highlight ? theme.spacing.xl : 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
            <Text variant="titleSm" numberOfLines={2} style={{ flexShrink: 1 }}>
              {club.name}
            </Text>
            {club.visibility === 'private' ? (
              <Icon name="lock-outline" size={16} color="textMuted" />
            ) : null}
          </View>
          <Text variant="bodySm" color="textMuted" numberOfLines={1} style={{ fontSize: 12 }}>
            {`Curadoria de ${club.ownerName} • ${membersLabel(club.memberCount)}`}
          </Text>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          borderRadius: theme.radii.lg,
          borderWidth: 1,
          borderColor: theme.colors.borderSoft,
          backgroundColor: theme.colors.surfaceMuted,
        }}
      >
        <BookCover
          title={club.book.title}
          author={club.book.author}
          coverUrls={club.book.coverUrls}
          width={44}
        />
        <View style={{ flex: 1, gap: theme.spacing.xs }}>
          <Text variant="label" numberOfLines={2}>
            {club.book.title}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            {club.weeklyGoalPages ? (
              <Pill tone="neutral" icon="speed" label={`${club.weeklyGoalPages} págs/semana`} />
            ) : null}
            {club.onMyShelf ? (
              <Pill
                tone="success"
                dot
                label={club.myPage ? `Você: pág. ${club.myPage}` : 'Na sua estante'}
              />
            ) : null}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        <Pill icon="shield" label="Blindagem ativa 100%" />
        <Pill tone="neutral" label={`${topicsLabel(club.topicCount)} ativos`} />
        {club.visibility === 'private' ? (
          <Pill tone="gold" icon="lock-outline" label="Privado" />
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {member || !onJoin ? (
          <Button
            label={member ? 'Abrir clube' : 'Ver detalhes'}
            icon={member ? 'forum' : undefined}
            size="md"
            style={{ flex: 1 }}
            onPress={onOpen}
          />
        ) : (
          <>
            <Button
              label="Entrar no clube"
              icon="login"
              size="md"
              loading={joining}
              style={{ flex: 1 }}
              onPress={onJoin}
            />
            <Button label="Ver detalhes" variant="secondary" size="md" compact onPress={onOpen} />
          </>
        )}
      </View>
    </Raised>
  );
}
