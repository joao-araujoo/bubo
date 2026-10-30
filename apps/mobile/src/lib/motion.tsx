import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { motion } from '../theme';

/** Tracks the OS "reduce motion" setting. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => mounted && setReduced(value))
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/**
 * Gentle fade + rise on mount. Skips the movement entirely when reduce motion is on.
 * `index` staggers siblings (e.g. Home cards) by a few frames.
 */
export function FadeIn({
  children,
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 0 : motion.slow,
      delay: reduced ? 0 : index * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduced, index]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [reduced ? 0 : motion.enterOffset, 0],
  });

  return (
    <Animated.View
      style={[style, { opacity: reduced ? 1 : progress, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}

/** Interruptible native-driver feedback. Layout and touch targets never move. */
export function useMotionValue(
  value: number,
  duration: number = motion.base,
  initialValue: number = value,
) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(initialValue)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: value,
      duration: reduced ? 0 : duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, value, reduced, duration]);
  return reduced ? value : progress;
}

/** One small greeting; no idle loops next to reading or typing. */
export function MascotGreeting({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      lift.setValue(0);
      return;
    }
    const animation = Animated.sequence([
      Animated.timing(lift, {
        toValue: -motion.enterOffset,
        duration: motion.slow,
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: motion.slow,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [lift, reduced]);
  return (
    <Animated.View style={{ transform: [{ translateY: reduced ? 0 : lift }] }}>
      {children}
    </Animated.View>
  );
}

/**
 * A 0 → 1 → 0 native loop for gentle ambient motion of whole elements (reading scenes, Revisar
 * seal), still at `rest` under reduced motion or when paused.
 */
export function useAmbientLoop(duration: number, active = true, rest = 0) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(rest)).current;
  useEffect(() => {
    if (reduced || !active) {
      value.setValue(rest);
      return;
    }
    const half = Math.round(duration / 2);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: half,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, duration, active, reduced, rest]);
  return value;
}
