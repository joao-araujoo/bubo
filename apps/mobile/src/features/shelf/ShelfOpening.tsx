import { type ShelfEntry } from '@bubo/contracts';
import { pagesThrough, stableBucket } from '@bubo/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useContext, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import { BuboLogo, ScreenBottomInset, Text } from '../../design-system';
import { useAmbientLoop, useReducedMotion } from '../../lib/motion';
import { coverPalettes, fontFamily, readingPalette, useTheme } from '../../theme';
import { SceneButton, useLightStatusBar } from '../session/scene';

const SPINE = { width: 64, height: 96, gap: 12 } as const;
const PER_ROW = 12;
const ROWS = 5;
const FADE_STOPS = [0, 0.36, 0.403, 0.45, 0.6, 0.74, 0.86] as const;

type Spine = { key: string; title: string; face: string; ink: string };

/** The reader's own books as typographic spines, repeated to fill the corridor. */
function spinesFor(entries: readonly ShelfEntry[], seed: number): Spine[] {
  const titles = entries.map((entry) => entry.book.title);
  return Array.from({ length: PER_ROW }, (_, index) => {
    const title = titles[(index * 3 + seed * 7) % Math.max(1, titles.length)] ?? '';
    const palette = coverPalettes[stableBucket(title, coverPalettes.length)] ?? coverPalettes[0];
    return {
      key: `${seed}-${index}`,
      title: title.toLocaleUpperCase('pt-BR'),
      face: palette?.face ?? readingPalette.corridorBg,
      ink: palette?.text ?? readingPalette.nightText,
    };
  });
}

function SpineView({ spine }: { spine: Spine }) {
  return (
    <View
      style={{
        width: SPINE.width,
        height: SPINE.height,
        borderTopLeftRadius: 2,
        borderBottomLeftRadius: 2,
        borderTopRightRadius: 5,
        borderBottomRightRadius: 5,
        backgroundColor: spine.face,
        paddingTop: 6,
        paddingBottom: 6,
        paddingLeft: 9,
        paddingRight: 4,
        justifyContent: 'flex-end',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 5,
          backgroundColor: readingPalette.spineShade,
        }}
      />
      <Text
        numberOfLines={4}
        style={{ fontFamily: fontFamily.black, fontSize: 8, lineHeight: 8, color: spine.ink }}
      >
        {spine.title}
      </Text>
    </View>
  );
}

/** One row of spines sliding forever (the row holds the books twice, so it loops seamlessly). */
function Row({
  spines,
  duration,
  reverse,
}: {
  spines: Spine[];
  duration: number;
  reverse: boolean;
}) {
  const reduced = useReducedMotion();
  const slide = useRef(new Animated.Value(0)).current;
  const half = PER_ROW * (SPINE.width + SPINE.gap);
  useEffect(() => {
    if (reduced) {
      slide.setValue(0.5);
      return;
    }
    slide.setValue(reverse ? 1 : 0);
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: reverse ? 0 : 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [slide, duration, reverse, reduced]);
  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        gap: SPINE.gap,
        transform: [
          { translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [0, -half] }) },
        ],
      }}
    >
      {[...spines, ...spines].map((spine, index) => (
        <SpineView key={`${spine.key}-${index}`} spine={spine} />
      ))}
    </Animated.View>
  );
}

function Plane({
  entries,
  seed,
  horizon,
  floor,
}: {
  entries: readonly ShelfEntry[];
  seed: number;
  horizon: number;
  floor: boolean;
}) {
  const { height } = useWindowDimensions();
  return (
    <View
      style={{
        position: 'absolute',
        left: -260,
        right: -260,
        height: 700,
        ...(floor ? { top: horizon } : { bottom: height - horizon }),
        flexDirection: floor ? 'column' : 'column-reverse',
        gap: 14,
        paddingTop: floor ? 6 : 0,
        paddingBottom: floor ? 0 : 6,
        transformOrigin: floor ? 'top' : 'bottom',
        transform: [{ perspective: 560 }, { rotateX: floor ? '72deg' : '-72deg' }],
      }}
    >
      {Array.from({ length: ROWS }, (_, row) => (
        <Row
          key={row}
          spines={spinesFor(entries, seed + row)}
          duration={(26 + ((row * 7 + seed) % 5) * 6) * 1000}
          reverse={(row + seed) % 2 === 1}
        />
      ))}
    </View>
  );
}

function Appear({ delay, children }: { delay: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: 500,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [value, delay, reduced]);
  return (
    <Animated.View
      style={{
        alignSelf: 'stretch',
        alignItems: 'center',
        opacity: value,
        transform: [
          { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * The Estante opening (ADR-046): a corridor of the reader's own books receding to a horizon,
 * the official Bubo symbol glowing in the middle, real counts and one way in. Shown at most once
 * a day; reduced motion keeps everything still.
 */
export function ShelfOpening({
  entries,
  onDone,
}: {
  entries: readonly ShelfEntry[];
  onDone: () => void;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const bottomInset = useContext(ScreenBottomInset);
  const { height } = useWindowDimensions();
  useLightStatusBar();
  const horizon = Math.round(height * 0.4);
  const tilt = useAmbientLoop(14_000, true, 0.5);
  const breathe = useAmbientLoop(3200, true, 0);
  const fade = useRef(new Animated.Value(1)).current;
  const pages = entries.reduce((sum, entry) => sum + pagesThrough(entry), 0);
  const books = entries.length;

  function close() {
    if (reduced) {
      onDone();
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: 260, useNativeDriver: true }).start(() =>
      onDone(),
    );
  }

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: readingPalette.corridorBg, overflow: 'hidden', opacity: fade },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { rotate: tilt.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] }) },
            ],
          },
        ]}
      >
        <Plane entries={entries} seed={0} horizon={horizon} floor />
        <Plane entries={entries} seed={3} horizon={horizon} floor={false} />
      </Animated.View>
      <LinearGradient
        pointerEvents="none"
        colors={readingPalette.corridorFade}
        locations={FADE_STOPS}
        style={StyleSheet.absoluteFill}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: horizon - 150,
          height: 300,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {[460, 340, 220].map((size) => (
          <View
            key={`amber-${size}`}
            style={{
              position: 'absolute',
              width: size,
              height: Math.round(size * 0.65),
              borderRadius: size,
              backgroundColor: readingPalette.corridorAmber,
            }}
          />
        ))}
        {[240, 170, 110].map((size) => (
          <View
            key={`violet-${size}`}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: readingPalette.corridorViolet,
            }}
          />
        ))}
        <Animated.View
          style={{
            transform: [
              { scale: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
            ],
          }}
        >
          <BuboLogo variant="symbol" height={110} />
        </Animated.View>
      </View>
      <View
        style={{
          position: 'absolute',
          left: theme.spacing.lg + theme.spacing.xs,
          right: theme.spacing.lg + theme.spacing.xs,
          bottom: bottomInset + theme.spacing.xl,
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Appear delay={900}>
          <Text
            accessibilityRole="header"
            align="center"
            style={{
              fontFamily: fontFamily.black,
              fontSize: 34,
              lineHeight: 38,
              letterSpacing: -0.7,
              color: readingPalette.nightText,
            }}
          >
            Sua estante
          </Text>
        </Appear>
        <Appear delay={1050}>
          <Text
            variant="bodyStrong"
            align="center"
            style={{ color: readingPalette.onCorridorMuted, fontFamily: fontFamily.bold }}
          >
            {books === 1 ? '1 livro' : `${books} livros`}
            {pages > 0 ? `, ${pages.toLocaleString('pt-BR')} páginas` : ''} e um universo inteiro
            seu.
          </Text>
        </Appear>
        <Appear delay={1200}>
          <SceneButton
            variant="gold"
            label="Abrir minha estante"
            icon="arrow-forward"
            style={{ marginTop: theme.spacing.lg, minWidth: 240 }}
            onPress={close}
          />
        </Appear>
      </View>
    </Animated.View>
  );
}
