import { type ComponentProps } from 'react';
import { Pressable } from 'react-native';

import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Raised } from './Raised';
import { Text } from './Text';

/**
 * Stitch `btn-tactile-chip`: a small raised chip with a thicker bottom rim. Active = lavender face,
 * purple stroke and deep-purple rim. Used for club sections and filter rows.
 */
export function TabChip({
  label,
  icon,
  selected,
  onPress,
  count,
  role = 'tab',
}: {
  label: string;
  icon?: ComponentProps<typeof Icon>['name'];
  selected: boolean;
  onPress: () => void;
  count?: number;
  role?: 'tab' | 'radio' | 'checkbox';
}) {
  const theme = useTheme();
  const text = count !== undefined ? `${label} (${count})` : label;
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === 'checkbox' ? { checked: selected } : { selected }}
      accessibilityLabel={text}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
    >
      {({ pressed }) => (
        <Raised
          faceColor={selected ? theme.colors.primarySoft : theme.colors.surface}
          borderColor={selected ? theme.colors.primary : theme.colors.border}
          rimColor={selected ? theme.colors.primaryRim : theme.colors.secondaryRim}
          radius={theme.radii.md}
          depth={3}
          pressed={pressed}
          faceStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            minHeight: 40,
            paddingHorizontal: theme.spacing.md,
          }}
        >
          {icon ? (
            <Icon name={icon} size={17} color={selected ? 'accentText' : 'textMuted'} />
          ) : null}
          <Text
            variant="label"
            color={selected ? 'accentText' : 'textMuted'}
            style={{ fontSize: 13 }}
          >
            {text}
          </Text>
        </Raised>
      )}
    </Pressable>
  );
}
