import { type ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import { Raised } from './Raised';

type Props = {
  children: ReactNode;
  tone?: 'default' | 'muted';
  /** Inner layout (padding, gap, alignment). */
  style?: StyleProp<ViewStyle>;
  /** Outer layout (flex, margins). */
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Surface card: 2px stroke with a solid (unblurred) offset below, per the design system. */
export function Card({
  children,
  tone = 'default',
  style,
  containerStyle,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      style={containerStyle}
    >
      <Raised
        faceColor={tone === 'muted' ? theme.colors.surfaceMuted : theme.colors.surface}
        borderColor={theme.colors.borderSoft}
        rimColor={theme.colors.cardShadow}
        radius={theme.radii.card}
        depth={theme.sizes.cardRim}
        style={{ flexGrow: 1 }}
        faceStyle={[{ flexGrow: 1, padding: theme.spacing.lg, gap: theme.spacing.md }, style]}
      >
        {children}
      </Raised>
    </View>
  );
}
