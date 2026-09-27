import { type ComponentProps } from 'react';
import { Animated, Pressable } from 'react-native';

import { useMotionValue } from '../lib/motion';
import { haptics } from '../lib/haptics';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  label: string;
  icon: ComponentProps<typeof Icon>['name'];
  selected: boolean;
  onPress: () => void;
};

/** Multi-select pill (genres). 48pt tall for comfortable touch. */
export function ToggleChip({ label, icon, selected, onPress }: Props) {
  const theme = useTheme();
  const scale = useMotionValue(selected ? 1.08 : 1);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        minHeight: theme.sizes.touchTarget,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: theme.radii.pill,
        borderWidth: theme.sizes.borderWidth,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
      }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon
          name={selected ? 'check' : icon}
          size={18}
          color={selected ? 'onPrimary' : 'accentText'}
        />
      </Animated.View>
      <Text variant="label" color={selected ? 'onPrimary' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}
