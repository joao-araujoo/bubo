import { Animated, View } from 'react-native';

import { useMotionValue } from '../lib/motion';
import { type ColorTokens, useTheme } from '../theme';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'orange' | 'gold' | 'muted';

const FILL: Record<ProgressTone, keyof ColorTokens> = {
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  orange: 'orange',
  gold: 'gold',
  muted: 'purpleLight',
};

/** sm = list rows (8 pt), md = default (12 pt), lg = Stitch reading "tube" (16 pt + highlight). */
const HEIGHT = { sm: 8, md: 12, lg: 16 } as const;

type Props = {
  /** 0–100 */
  percent: number;
  accessibilityLabel: string;
  fromPercent?: number;
  tone?: ProgressTone;
  size?: keyof typeof HEIGHT;
};

/** Chunky rounded progress track. */
export function ProgressBar({
  percent,
  accessibilityLabel,
  fromPercent = percent,
  tone = 'primary',
  size = 'md',
}: Props) {
  const theme = useTheme();
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const scaleX = useMotionValue(
    value / 100,
    theme.motion.slow,
    Math.max(0, Math.min(100, fromPercent)) / 100,
  );
  const height = size === 'md' ? theme.sizes.progressTrack : HEIGHT[size];
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={{
        height,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.borderSoft,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          width: '100%',
          transformOrigin: 'left center',
          transform: [{ scaleX }],
          height: '100%',
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors[FILL[tone]],
        }}
      >
        {size === 'lg' ? (
          <View
            style={{
              position: 'absolute',
              left: 6,
              right: 6,
              top: 3,
              height: 3,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.tubeHighlight,
            }}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}
