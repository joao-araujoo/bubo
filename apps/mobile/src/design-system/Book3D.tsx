import { bookThickness } from '@bubo/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '../lib/haptics';
import { useReducedMotion } from '../lib/motion';
import { bookPalette, useTheme } from '../theme';
import { BookCover } from './BookCover';

type Props = {
  title: string;
  author?: string | null;
  coverUrls?: readonly string[];
  /** Real page count; drives the drawn thickness (unknown → median). */
  totalPages?: number | null;
  /** Cover width in points. The object is a little wider because of the fore-edge. */
  width: number;
  priority?: 'low' | 'normal' | 'high';
};

/** Resting tilt of the book, in degrees (right edge toward the reader). */
const REST_TILT = -28;
/** Entrance tilt: the book swings in from a steeper angle and settles. */
const ENTER_TILT = -46;
/** Maximum fore-edge depth, in points, for the longest books. */
const MAX_DEPTH = 30;
const PERSPECTIVE = 1000;
/** Page stripes on the fore-edge: alternating paper tones along the depth axis. */
const PAGE_STRIPES = 7;
/**
 * A soft shadow without native blur: concentric ellipses, each a little smaller and barely
 * darker than the one before, so the edge fades instead of printing a hard pill on the page.
 */
const SHADOW_LAYERS = [
  { size: 100, opacity: 0.035 },
  { size: 84, opacity: 0.045 },
  { size: 68, opacity: 0.055 },
  { size: 52, opacity: 0.06 },
  { size: 36, opacity: 0.06 },
] as const;
const STRIPES: readonly [string, string, ...string[]] = [
  bookPalette.paper,
  bookPalette.paperEdge,
  ...Array.from({ length: (PAGE_STRIPES - 1) * 2 }, (_, i) =>
    i % 2 === 0 ? bookPalette.paper : bookPalette.paperEdge,
  ),
];

/**
 * The book as a physical object: the cover hinged on its right edge, a real fore-edge face
 * (paper stripes) at a right angle, a hinge groove on the spine side, a soft gloss and a shadow
 * underneath. The whole thing tilts toward the reader while pressed and settles back; with
 * "reduce motion" it stays still at the resting angle. Thickness comes from the real page
 * count (`bookThickness`). Only single-level transforms are used, so Android and iOS draw it the
 * same way and nothing in the layout moves.
 */
export function Book3D({ title, author, coverUrls, totalPages, width, priority }: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const height = Math.round(width * 1.5);
  const depth = Math.max(10, Math.round(MAX_DEPTH * bookThickness(totalPages)));
  const [pressed, setPressed] = useState(false);
  // -1 = entrance angle, 0 = resting tilt, 1 = facing the reader (pressed).
  const tilt = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (reduced) {
      tilt.setValue(0);
      return;
    }
    const animation = Animated.spring(tilt, {
      toValue: pressed ? 1 : 0,
      damping: 14,
      stiffness: 140,
      mass: 0.9,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [tilt, pressed, reduced]);

  const coverRotate = tilt.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [`${ENTER_TILT}deg`, `${REST_TILT}deg`, '0deg'],
    extrapolate: 'clamp',
  });
  const edgeRotate = tilt.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [`${ENTER_TILT + 90}deg`, `${REST_TILT + 90}deg`, '90deg'],
    extrapolate: 'clamp',
  });
  const scale = tilt.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.97, 1, 1.03],
    extrapolate: 'clamp',
  });
  const shadowScale = tilt.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [0.9, 1, 1.08],
    extrapolate: 'clamp',
  });

  const dark = theme.scheme === 'dark';
  const shadowColor = dark ? bookPalette.shadowDark : bookPalette.shadowLight;
  const shadowHeight = Math.round(width * 0.09);
  const gutter = Math.round(depth * 0.6);
  const topInset = theme.spacing.xs;

  return (
    <View
      style={{
        width: width + gutter,
        height: topInset + height + shadowHeight + theme.spacing.sm,
        alignItems: 'flex-start',
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: Math.round(width * 0.1),
          bottom: Math.round(shadowHeight * 0.35),
          width: Math.round(width * 0.9),
          height: shadowHeight,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scaleX: shadowScale }],
        }}
      >
        {SHADOW_LAYERS.map((layer) => (
          <View
            key={layer.size}
            style={{
              position: 'absolute',
              width: `${layer.size}%`,
              height: `${layer.size}%`,
              borderRadius: theme.radii.pill,
              backgroundColor: shadowColor,
              opacity: layer.opacity * (dark ? 2.2 : 1),
            }}
          />
        ))}
      </Animated.View>
      <Pressable
        accessible={false}
        onPressIn={() => {
          haptics.press();
          setPressed(true);
        }}
        onPressOut={() => setPressed(false)}
        style={{ width: width + gutter, height: topInset + height, paddingTop: topInset }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: topInset + 2,
            left: width,
            width: depth,
            height: height - 4,
            borderTopRightRadius: 3,
            borderBottomRightRadius: 3,
            overflow: 'hidden',
            backgroundColor: bookPalette.paper,
            transform: [
              { perspective: PERSPECTIVE },
              { scale },
              { translateX: -depth / 2 },
              { rotateY: edgeRotate },
              { translateX: depth / 2 },
            ],
          }}
        >
          <LinearGradient
            colors={STRIPES}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[bookPalette.hingeFade, bookPalette.transparent, bookPalette.hingeDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          style={{
            width,
            height,
            borderRadius: theme.radii.md,
            overflow: 'hidden',
            transform: [
              { perspective: PERSPECTIVE },
              { scale },
              { translateX: width / 2 },
              { rotateY: coverRotate },
              { translateX: -width / 2 },
            ],
          }}
        >
          <BookCover
            title={title}
            author={author}
            coverUrls={coverUrls}
            width={width}
            height={height}
            priority={priority}
            style={styles.coverFrame}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[
              bookPalette.hingeDark,
              bookPalette.hingeLight,
              bookPalette.hingeFade,
              bookPalette.transparent,
            ]}
            locations={[0, 0.18, 0.4, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFill, { width: Math.round(width * 0.14) }]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[bookPalette.gloss, bookPalette.transparent, bookPalette.transparent]}
            locations={[0, 0.45, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  /** The hinge edge meets the fore-edge, so it stays square there. */
  coverFrame: { borderTopRightRadius: 2, borderBottomRightRadius: 2 },
});
