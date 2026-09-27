import { Pressable } from 'react-native';

import { haptics } from '../lib/haptics';
import { type ColorTokens, useTheme } from '../theme';
import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  color?: keyof ColorTokens;
  align?: 'left' | 'center' | 'right';
  accessibilityHint?: string;
};

/** Text-only action with a full 48pt touch target. */
export function LinkButton({
  label,
  onPress,
  color = 'accentText',
  align = 'center',
  accessibilityHint,
}: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touchTarget,
        justifyContent: 'center',
        alignSelf: align === 'center' ? 'center' : align === 'left' ? 'flex-start' : 'flex-end',
        paddingHorizontal: theme.spacing.xs,
      }}
    >
      <Text variant="label" color={color} align={align}>
        {label}
      </Text>
    </Pressable>
  );
}
