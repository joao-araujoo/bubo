import { View } from 'react-native';

import { type ColorTokens, useTheme } from '../theme';

const SEGMENTS = 80;

/**
 * Dashed rule drawn with short segments: Android cannot dash a single border side. Horizontal by
 * default; `vertical` fills the parent's height (ticket stubs, receipt tears).
 */
export function DashedRule({
  color = 'borderSoft',
  tint,
  dash = 6,
  gap = 4,
  thickness = 2,
  vertical = false,
}: {
  color?: keyof ColorTokens;
  /** Fixed colour from a scene palette; wins over `color`. */
  tint?: string;
  dash?: number;
  gap?: number;
  thickness?: number;
  vertical?: boolean;
}) {
  const theme = useTheme();
  const fill = tint ?? theme.colors[color];
  // The segments sit in an absolute layer so they never size the parent; the outer view takes
  // the parent's width (or height when vertical) and clips them.
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={
        vertical
          ? { width: thickness, alignSelf: 'stretch' }
          : { height: thickness, alignSelf: 'stretch' }
      }
    >
      <View
        style={[
          { position: 'absolute', top: 0, left: 0, overflow: 'hidden', gap },
          vertical
            ? { bottom: 0, width: thickness, flexDirection: 'column' }
            : { right: 0, height: thickness, flexDirection: 'row' },
        ]}
      >
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <View
            key={index}
            style={
              vertical
                ? { width: thickness, height: dash, backgroundColor: fill }
                : { width: dash, height: thickness, backgroundColor: fill }
            }
          />
        ))}
      </View>
    </View>
  );
}
