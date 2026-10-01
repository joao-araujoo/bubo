import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';

/**
 * Stitch purple hero ("Índice cognitivo", club profile header): a diagonal Bubo-purple gradient
 * with two soft decorative circles and a deep-purple rim underneath (pushdown depth).
 */
export function GradientCard({
  children,
  style,
  radius,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const r = radius ?? theme.radii.card;
  return (
    <View
      accessible={accessibilityLabel !== undefined}
      accessibilityLabel={accessibilityLabel}
      style={{ paddingBottom: theme.sizes.cardRim }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: theme.sizes.cardRim,
          bottom: 0,
          borderRadius: r,
          backgroundColor: theme.colors.heroEnd,
        }}
      />
      <LinearGradient
        colors={[theme.colors.heroStart, theme.colors.heroEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[{ borderRadius: r, overflow: 'hidden', padding: theme.spacing.lg }, style]}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: -40,
            bottom: -50,
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: theme.colors.heroGlow,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: 40,
            top: -30,
            width: 90,
            height: 90,
            borderRadius: 45,
            backgroundColor: theme.colors.heroGlowSoft,
          }}
        />
        {children}
      </LinearGradient>
    </View>
  );
}
