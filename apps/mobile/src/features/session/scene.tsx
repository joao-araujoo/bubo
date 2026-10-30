import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { type ComponentProps, type ReactNode, useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

import { Icon, Raised, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useAmbientLoop, useReducedMotion } from '../../lib/motion';
import { readingPalette, useTheme } from '../../theme';

/**
 * Shared pieces of the reading-flow scenes (ADR-044): the night of the timer and of the streak,
 * and the violet receipt. Colours come from the fixed `readingPalette`; every loop is a gentle
 * whole-element transform that stops under reduced motion.
 */

type SceneButtonVariant = 'gold' | 'glass' | 'white' | 'outline';

const SCENE_BUTTONS: Record<
  SceneButtonVariant,
  { face: string; border: string; rim: string | null; text: string }
> = {
  gold: {
    face: readingPalette.gold,
    border: readingPalette.gold,
    rim: readingPalette.goldRim,
    text: readingPalette.onGold,
  },
  glass: {
    face: readingPalette.glass,
    border: readingPalette.glassBorder,
    rim: null,
    text: readingPalette.nightText,
  },
  white: {
    face: readingPalette.receiptButton,
    border: readingPalette.receiptButton,
    rim: readingPalette.receiptButtonRim,
    text: readingPalette.onReceiptButton,
  },
  outline: {
    face: readingPalette.transparent,
    border: readingPalette.receiptOutline,
    rim: null,
    text: readingPalette.onReceiptBg,
  },
};

/** Tactile button for the scenes: solid faces sink onto their rim, glass ones just dim. */
export function SceneButton({
  label,
  onPress,
  variant,
  icon,
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: {
  label: string;
  onPress: () => void;
  variant: SceneButtonVariant;
  icon?: ComponentProps<typeof Icon>['name'];
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const colors = SCENE_BUTTONS[variant];
  const inactive = disabled || loading;
  const content = loading ? (
    <ActivityIndicator color={colors.text} />
  ) : (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.xs,
      }}
    >
      {icon ? <Icon name={icon} size={20} tint={colors.text} /> : null}
      <Text
        variant="labelLg"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{ color: colors.text, flexShrink: 1 }}
      >
        {label}
      </Text>
    </View>
  );
  const face: ViewStyle = {
    minHeight: theme.sizes.ctaHeight,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPressIn={() => (colors.rim ? haptics.commit() : haptics.press())}
      onPress={onPress}
      style={[{ opacity: inactive ? 0.5 : 1 }, style]}
    >
      {({ pressed }) =>
        colors.rim ? (
          <Raised
            faceColor={colors.face}
            borderColor={colors.border}
            rimColor={colors.rim}
            radius={theme.radii.lg}
            depth={theme.sizes.rim}
            pressed={pressed && !inactive}
            faceStyle={face}
          >
            {content}
          </Raised>
        ) : (
          <View
            style={[
              face,
              {
                borderRadius: theme.radii.lg,
                borderWidth: 1.5,
                borderColor: colors.border,
                backgroundColor: colors.face,
                opacity: pressed && !inactive ? 0.75 : 1,
              },
            ]}
          >
            {content}
          </View>
        )
      }
    </Pressable>
  );
}

/**
 * Light status bar while a scene is focused, restored to the theme default when it leaves. Set a
 * tick later so it lands after the previous screen's own blur cleanup (Hoje does the same).
 */
export function useLightStatusBar() {
  const theme = useTheme();
  useFocusEffect(
    useCallback(() => {
      const id = setTimeout(() => setStatusBarStyle('light'), 0);
      return () => {
        clearTimeout(id);
        setStatusBarStyle(theme.scheme === 'dark' ? 'light' : 'dark');
      };
    }, [theme.scheme]),
  );
}

/** 48 pt round glass button (close, discard) for the night scenes. */
export function SceneIconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPressIn={() => haptics.press()}
      onPress={onPress}
      style={({ pressed }) => ({
        width: theme.sizes.touchTarget,
        height: theme.sizes.touchTarget,
        borderRadius: theme.radii.pill,
        borderWidth: 1.5,
        borderColor: readingPalette.glassBorder,
        backgroundColor: readingPalette.glass,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <Icon name={icon} size={22} tint={readingPalette.nightText} />
    </Pressable>
  );
}

/** Warm reading-lamp glow in the top-left corner: stacked faint circles that breathe. */
export function LampGlow() {
  const glow = useAmbientLoop(6000, true, 1);
  const opacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: -120, top: -140, width: 520, height: 520, opacity }}
    >
      {[520, 400, 290, 190].map((size) => (
        <View
          key={size}
          style={{
            position: 'absolute',
            left: (520 - size) / 2,
            top: (520 - size) / 2,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: readingPalette.lamp,
          }}
        />
      ))}
    </Animated.View>
  );
}

const STARS = [
  { left: '8%', top: 70, delay: 0 },
  { left: '31%', top: 40, delay: 1000 },
  { left: '64%', top: 90, delay: 2000 },
  { left: '87%', top: 52, delay: 500 },
  { left: '77%', top: 180, delay: 1400 },
  { left: '15%', top: 200, delay: 2400 },
] as const;

function Star({ left, top, delay }: { left: `${number}%`; top: number; delay: number }) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 0.9, duration: 1500, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0.2, duration: 1500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, delay, reduced]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        top,
        width: 3,
        height: 3,
        borderRadius: 2,
        backgroundColor: readingPalette.star,
        opacity: value,
      }}
    />
  );
}

/** A few twinkling stars for the night scenes. */
export function Stars() {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 220 }}
    >
      {STARS.map((star) => (
        <Star key={`${star.left}-${star.top}`} {...star} />
      ))}
    </View>
  );
}

/** Small glass pill for scene notices ("Hoje já pode contar…"). */
export function ScenePill({
  icon,
  tone = 'flame',
  children,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  tone?: 'flame' | 'glass';
  children: ReactNode;
}) {
  const theme = useTheme();
  const flame = tone === 'flame';
  return (
    <View
      accessibilityRole="text"
      style={{
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        maxWidth: '100%',
        paddingVertical: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md - 2,
        borderRadius: theme.radii.pill,
        borderWidth: 1.5,
        borderColor: flame ? readingPalette.flameBorder : readingPalette.glassBorder,
        backgroundColor: flame ? readingPalette.flameWash : readingPalette.glass,
      }}
    >
      <Icon name={icon} size={16} tint={flame ? readingPalette.flame : readingPalette.nightText} />
      <Text
        variant="label"
        style={{
          color: flame ? readingPalette.flameText : readingPalette.nightText,
          flexShrink: 1,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

/** Quiet text action for the scenes (≥ 48 pt tall), e.g. "Ver anotação completa". */
export function SceneTextButton({
  label,
  icon,
  onPress,
  disabled = false,
  color = readingPalette.purpleOnNight,
  accessibilityHint,
}: {
  label: string;
  icon?: ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  disabled?: boolean;
  color?: string;
  accessibilityHint?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => haptics.selection()}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: theme.sizes.touchTarget,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={18} tint={color} /> : null}
      <Text variant="label" style={{ color }}>
        {label}
      </Text>
    </Pressable>
  );
}
