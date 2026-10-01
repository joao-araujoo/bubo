import { type ReactionCounts } from '@bubo/contracts';
import { REACTION_KINDS, type ReactionKind } from '@bubo/domain';
import { Pressable, View } from 'react-native';

import { Icon, Raised, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useTheme } from '../../theme';
import { REACTION_META } from './meta';

/**
 * Stitch reaction pills ("🧠 Fez pensar 18", "💡 9") drawn with Material icons. Tapping toggles
 * the reader's own reaction; own or locked content shows counts only.
 */
export function ReactionBar({
  reactions,
  mine,
  onToggle,
  disabled = false,
  showLabels = false,
  kinds = REACTION_KINDS,
}: {
  reactions: ReactionCounts;
  mine: readonly ReactionKind[];
  onToggle?: (kind: ReactionKind, active: boolean) => void;
  disabled?: boolean;
  showLabels?: boolean;
  kinds?: readonly ReactionKind[];
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {kinds.map((kind) => {
        const meta = REACTION_META[kind];
        const active = mine.includes(kind);
        const count = reactions[kind];
        if (disabled && count === 0) return null;
        return (
          <Pressable
            key={kind}
            disabled={disabled || !onToggle}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled: disabled || !onToggle }}
            accessibilityLabel={`${meta.label}: ${count}`}
            accessibilityHint={active ? 'Toque para desfazer' : 'Toque para reagir'}
            hitSlop={{ top: 6, bottom: 6 }}
            onPress={() => {
              haptics.selection();
              onToggle?.(kind, !active);
            }}
          >
            {({ pressed }) => (
              <Raised
                faceColor={active ? theme.colors.primarySoft : theme.colors.surface}
                borderColor={active ? theme.colors.primary : theme.colors.border}
                rimColor={active ? theme.colors.primaryRim : theme.colors.secondaryRim}
                radius={theme.radii.md}
                depth={3}
                pressed={pressed}
                faceStyle={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.xs,
                  minHeight: 36,
                  paddingHorizontal: theme.spacing.md,
                }}
              >
                <Icon name={meta.icon} size={17} color={active ? 'accentText' : 'textMuted'} />
                {showLabels ? (
                  <Text variant="label" style={{ fontSize: 13 }}>
                    {meta.label}
                  </Text>
                ) : null}
                <Text variant="label" color="accentText" style={{ fontSize: 13 }}>
                  {count}
                </Text>
              </Raised>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
