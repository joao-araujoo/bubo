import { type ReactNode } from 'react';
import { View } from 'react-native';

import { type ColorTokens, useTheme } from '../theme';

/**
 * Circular progress drawn with two clipped half rings (no SVG dependency). The right half fills
 * the first 50 % clockwise from the top, the left half the rest. `children` sit in the centre.
 */
export function ProgressRing({
  progress,
  size,
  stroke,
  color = 'primary',
  track = 'primarySoft',
  children,
  accessibilityLabel,
}: {
  /** 0–1; values outside are clamped. */
  progress: number;
  size: number;
  stroke: number;
  color?: keyof ColorTokens;
  track?: keyof ColorTokens;
  children?: ReactNode;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const half = size / 2;
  const value = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const rightDeg = Math.min(value, 0.5) * 360;
  const leftDeg = Math.max(value - 0.5, 0) * 360;
  const ring = {
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: stroke,
    borderColor: theme.colors[color],
  };
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ width: size, height: size }}
    >
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: stroke,
          borderColor: theme.colors[track],
        }}
      />
      {value > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: half,
            width: half,
            height: size,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: -half,
              width: size,
              height: size,
              transform: [{ rotate: `${rightDeg}deg` }],
            }}
          >
            <View style={{ position: 'absolute', width: half, height: size, overflow: 'hidden' }}>
              <View style={ring} />
            </View>
          </View>
        </View>
      ) : null}
      {value > 0.5 ? (
        <View style={{ position: 'absolute', width: half, height: size, overflow: 'hidden' }}>
          <View
            style={{
              position: 'absolute',
              width: size,
              height: size,
              transform: [{ rotate: `${leftDeg}deg` }],
            }}
          >
            <View
              style={{
                position: 'absolute',
                left: half,
                width: half,
                height: size,
                overflow: 'hidden',
              }}
            >
              <View style={[ring, { position: 'absolute', left: -half }]} />
            </View>
          </View>
        </View>
      ) : null}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}
