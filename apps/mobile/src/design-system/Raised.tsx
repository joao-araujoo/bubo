import { type ReactNode } from 'react';
import { Animated, type StyleProp, View, type ViewStyle } from 'react-native';

import { useMotionValue } from '../lib/motion';
import { useTheme } from '../theme';

type Props = {
  children: ReactNode;
  faceColor: string;
  borderColor: string;
  /** Colour of the solid "3D" offset below the face. */
  rimColor: string;
  radius: number;
  /** Offset depth in points. */
  depth: number;
  /** Pressed faces sink onto the rim (tactile pushdown). */
  pressed?: boolean;
  /** Layout of the whole element (flex, margins, alignSelf). */
  style?: StyleProp<ViewStyle>;
  /** Inner layout of the face (padding, gap, alignment, minHeight). */
  faceStyle?: StyleProp<ViewStyle>;
};

/**
 * Tactile depth done with two layers: a solid rim layer offset below and the face on top.
 * Uniform borders on the face avoid the artefacts of mixing border widths with large radii
 * (uneven, darker bottom edges on Android).
 */
export function Raised({
  children,
  faceColor,
  borderColor,
  rimColor,
  radius,
  depth,
  pressed = false,
  style,
  faceStyle,
}: Props) {
  const theme = useTheme();
  const translateY = useMotionValue(pressed ? depth : 0, theme.motion.fast);
  return (
    <View style={[{ paddingBottom: depth }, style]}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: depth,
          bottom: 0,
          borderRadius: radius,
          backgroundColor: rimColor,
        }}
      />
      <Animated.View
        style={[
          {
            borderRadius: radius,
            borderWidth: theme.sizes.borderWidth,
            borderColor,
            backgroundColor: faceColor,
            transform: [{ translateY }],
          },
          faceStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}
