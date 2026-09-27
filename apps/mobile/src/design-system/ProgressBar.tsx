import { Animated, View } from 'react-native';

import { useMotionValue } from '../lib/motion';
import { useTheme } from '../theme';

type Props = {
  /** 0–100 */
  percent: number;
  accessibilityLabel: string;
  fromPercent?: number;
};

/** Chunky rounded progress track. */
export function ProgressBar({ percent, accessibilityLabel, fromPercent = percent }: Props) {
  const theme = useTheme();
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  const scaleX = useMotionValue(
    value / 100,
    theme.motion.slow,
    Math.max(0, Math.min(100, fromPercent)) / 100,
  );
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: value }}
      style={{
        height: theme.sizes.progressTrack,
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
          backgroundColor: theme.colors.primary,
        }}
      />
    </View>
  );
}
