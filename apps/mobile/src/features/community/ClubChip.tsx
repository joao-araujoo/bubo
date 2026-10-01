import { type ClubSummary } from '@bubo/contracts';
import { Pressable, View } from 'react-native';

import { Raised, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { ClubBadge } from './ClubBadge';

/** Stitch "Seus clubes" horizontal chip: badge, name, "Livro • Meta 75p/sem" and a live dot. */
export function ClubChip({ club, onPress }: { club: ClubSummary; onPress: () => void }) {
  const theme = useTheme();
  const sub = club.weeklyGoalPages
    ? `${club.book.title} • Meta ${club.weeklyGoalPages}p/sem`
    : club.book.title;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Clube ${club.name}. ${sub}`}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.primary}
          rimColor={theme.colors.primaryRim}
          radius={theme.radii.lg}
          depth={3}
          pressed={pressed}
          faceStyle={{
            width: 220,
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            padding: theme.spacing.sm,
          }}
        >
          <ClubBadge icon={club.icon} size={34} />
          <View style={{ flex: 1 }}>
            <Text variant="label" numberOfLines={1}>
              {club.name}
            </Text>
            <Text variant="bodySm" color="accentText" numberOfLines={1} style={{ fontSize: 11 }}>
              {sub}
            </Text>
          </View>
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.success,
            }}
          />
        </Raised>
      )}
    </Pressable>
  );
}
