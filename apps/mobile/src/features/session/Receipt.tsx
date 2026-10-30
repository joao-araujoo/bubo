import { type SessionResult } from '@bubo/contracts';
import { crossedReadingMilestone } from '@bubo/domain';
import { useRouter } from 'expo-router';
import { type ComponentProps, type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, Share, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BuboLogo, BuboMascot, DashedRule, Icon, InlineMessage, Text } from '../../design-system';
import { useReducedMotion } from '../../lib/motion';
import { accentFontFamily, fontFamily, readingPalette, useTheme } from '../../theme';
import { type CoachNote } from './RecallCard';
import { SceneButton, useLightStatusBar } from './scene';
import { formatDuration } from './useFocusTimer';

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const BARS = [
  2, 1, 3, 1, 2, 2, 1, 3, 1, 1, 2, 3, 1, 2, 1, 1, 3, 2, 1, 2, 1, 3, 1, 2, 2, 1, 1, 3, 2, 1, 2, 1, 3,
  1, 2,
];
const MILESTONE: Record<25 | 50 | 75 | 100, { row: string; line: (title: string) => string }> = {
  25: { row: 'Um quarto do livro', line: (title) => `E você chegou a um quarto de ${title}.` },
  50: { row: 'Metade do livro', line: (title) => `E você passou da metade de ${title}.` },
  75: { row: 'Três quartos', line: (title) => `E você passou de três quartos de ${title}.` },
  100: { row: 'Livro concluído', line: (title) => `Você terminou ${title}. Que jornada!` },
};

/** "29 OUT 2026 · 23:12" in the reader's local time. */
function receiptStamp(iso: string) {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())} ${MONTHS[date.getMonth()] ?? ''} ${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * The end of a session as a printed reading receipt (ADR-044). Every row is the server's answer:
 * pages, focused time, the three recall answers, the XP the API awarded (one per focused minute),
 * the streak and the book milestone this session crossed. Nothing is added for show.
 */
export function ReceiptStep({
  result,
  cleanupWarning,
  coach,
  celebrateStreak,
}: {
  result: SessionResult;
  cleanupWarning?: string;
  coach: CoachNote;
  celebrateStreak: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  useLightStatusBar();
  const { session, entry, stats } = result;
  const book = entry.book;
  const finishedBook = entry.status === 'finished';
  const milestone =
    book.totalPages !== null
      ? crossedReadingMilestone(session.startPage, session.endPage, book.totalPages)
      : null;
  const minutes = Math.floor(session.focusedSeconds / 60);
  const receiptWidth = Math.min(300, width - 2 * (theme.sizes.gutter + theme.spacing.lg));
  const subtitle = finishedBook
    ? MILESTONE[100].line(book.title)
    : milestone
      ? MILESTONE[milestone].line(book.title)
      : 'Cada sessão fortalece o que você vai lembrar amanhã.';
  const streakLabel = `${stats.streakDays} ${stats.streakDays === 1 ? 'dia' : 'dias'}`;

  function share() {
    const lines = [
      'Recibo de leitura · Bubo',
      `${book.title}${book.author ? ` — ${book.author}` : ''}`,
      `Páginas ${session.startPage} → ${session.endPage} · Foco ${formatDuration(session.focusedSeconds)}`,
      `+${result.xpEarned} XP · Sequência de ${streakLabel}`,
    ];
    void Share.share({ message: lines.join('\n') }).catch(() => undefined);
  }

  function next() {
    if (celebrateStreak) router.replace({ pathname: '/sequencia', params: { depois: 'leitura' } });
    else router.dismissTo('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: readingPalette.receiptBg, overflow: 'hidden' }}>
      <Confetti />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + theme.spacing.xl,
          paddingBottom: theme.spacing.lg,
          gap: theme.spacing.lg,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            paddingHorizontal: theme.sizes.gutter + theme.spacing.xs,
          }}
        >
          <Rise>
            <BuboMascot
              state={finishedBook ? 'achievementUnlocked' : 'sessionComplete'}
              size={112}
            />
          </Rise>
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text
              variant="display"
              accessibilityRole="header"
              style={{ color: readingPalette.onReceiptBg, fontSize: 27, lineHeight: 32 }}
            >
              {finishedBook ? 'Livro concluído!' : 'Leitura guardada!'}
            </Text>
            <Text variant="bodyStrong" style={{ color: readingPalette.onReceiptBgMuted }}>
              {subtitle}
            </Text>
          </View>
        </View>

        {cleanupWarning ? (
          <View style={{ paddingHorizontal: theme.sizes.gutter }}>
            <InlineMessage tone="info" message={cleanupWarning} />
          </View>
        ) : null}

        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: receiptWidth + 36,
              height: 14,
              borderRadius: 7,
              backgroundColor: readingPalette.receiptSlot,
            }}
          />
          <Printed width={receiptWidth}>
            <View
              style={{
                backgroundColor: readingPalette.paper,
                paddingTop: theme.spacing.lg,
                paddingHorizontal: 18,
                paddingBottom: 10,
              }}
            >
              <View style={{ alignItems: 'center', gap: theme.spacing.xxs }}>
                <BuboLogo height={20} />
                <Mono bold size={12} spacing={1.7} style={{ marginTop: 6 }}>
                  RECIBO DE LEITURA
                </Mono>
                <Mono size={11} muted>
                  {receiptStamp(session.endedAt)}
                </Mono>
              </View>
              <Dashes />
              <Text
                variant="label"
                numberOfLines={2}
                style={{
                  color: readingPalette.paperInk,
                  fontFamily: fontFamily.extrabold,
                  fontSize: 15,
                }}
              >
                {book.title}
              </Text>
              {book.author ? (
                <Text
                  variant="bodySm"
                  style={{ color: readingPalette.paperMuted, marginBottom: 4 }}
                >
                  {book.author}
                </Text>
              ) : null}
              <Row label="Páginas" value={`${session.startPage} → ${session.endPage}`} />
              <Row label="Foco" value={formatDuration(session.focusedSeconds)} />
              <Row label="Lembranças" value={session.recall ? '3 de 3' : '—'} />
              <Dashes />
              <Row label={`Leitura · ${minutes} min`} value={`+${session.xpEarned} XP`} />
              <Total xp={result.xpEarned} />
              <Dashes />
              <Row
                icon="local-fire-department"
                iconTint={readingPalette.flame}
                label="Sequência"
                value={streakLabel}
                valueColor={readingPalette.receiptStreakInk}
              />
              {milestone || finishedBook ? (
                <Row
                  icon="star"
                  iconTint={readingPalette.goldRim}
                  label="Marco"
                  value={MILESTONE[finishedBook ? 100 : (milestone ?? 100)].row}
                  valueColor={readingPalette.receiptMilestoneInk}
                />
              ) : null}
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 2,
                  height: 30,
                  marginTop: theme.spacing.md,
                  marginBottom: theme.spacing.xs,
                }}
              >
                {BARS.map((bar, index) => (
                  <View
                    key={index}
                    style={{ width: bar, backgroundColor: readingPalette.paperInk }}
                  />
                ))}
              </View>
              <Mono size={10} muted spacing={2} style={{ textAlign: 'center' }}>
                OBRIGADO POR LER
              </Mono>
            </View>
            <Zigzag width={receiptWidth} />
          </Printed>
        </View>

        {coach.question ? (
          <View
            style={{
              marginHorizontal: theme.sizes.gutter,
              padding: theme.spacing.lg,
              gap: theme.spacing.xs,
              borderRadius: theme.radii.card,
              borderWidth: 1.5,
              borderColor: readingPalette.receiptOutline,
            }}
          >
            <Text variant="caption" style={{ color: readingPalette.onReceiptBgMuted }}>
              Pra pensar até a próxima
            </Text>
            <Text variant="bodyStrong" style={{ color: readingPalette.onReceiptBg }}>
              {coach.question}
            </Text>
          </View>
        ) : coach.unavailable ? (
          <Text
            variant="bodySm"
            align="center"
            style={{
              color: readingPalette.onReceiptBgMuted,
              paddingHorizontal: theme.sizes.gutter,
            }}
          >
            A pergunta extra não estava disponível desta vez. Sua leitura foi salva normalmente.
          </Text>
        ) : null}
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.sm + 2,
          paddingHorizontal: theme.sizes.gutter,
          paddingTop: theme.spacing.sm,
          paddingBottom: insets.bottom + theme.spacing.lg,
        }}
      >
        <SceneButton
          variant="outline"
          label="Compartilhar"
          icon="ios-share"
          style={{ flex: 1 }}
          onPress={share}
        />
        <SceneButton
          variant="white"
          label="Continuar"
          accessibilityLabel={celebrateStreak ? 'Continuar para a sequência' : 'Voltar para Hoje'}
          style={{ flex: 1.3 }}
          onPress={next}
        />
      </View>
    </View>
  );
}

function Mono({
  children,
  size = 13,
  bold = false,
  muted = false,
  spacing = 0,
  color,
  style,
}: {
  children: ReactNode;
  size?: number;
  bold?: boolean;
  muted?: boolean;
  spacing?: number;
  color?: string;
  style?: ComponentProps<typeof Text>['style'];
}) {
  return (
    <Text
      style={[
        {
          fontFamily: bold ? accentFontFamily.monoBold : accentFontFamily.mono,
          fontSize: size,
          lineHeight: Math.round(size * 1.6),
          letterSpacing: spacing,
          color: color ?? (muted ? readingPalette.paperMuted : readingPalette.paperInk),
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

function Row({
  label,
  value,
  icon,
  iconTint,
  valueColor,
}: {
  label: string;
  value: string;
  icon?: ComponentProps<typeof Icon>['name'];
  iconTint?: string;
  valueColor?: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}
    >
      {icon ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Icon name={icon} size={16} tint={iconTint} />
          <Text
            variant="label"
            style={{ color: readingPalette.paperInk, fontSize: 13, lineHeight: 21 }}
          >
            {label}
          </Text>
        </View>
      ) : (
        <Mono muted>{label}</Mono>
      )}
      {icon ? (
        <Text
          variant="label"
          style={{ color: valueColor ?? readingPalette.paperInk, fontSize: 13, lineHeight: 21 }}
        >
          {value}
        </Text>
      ) : (
        <Mono color={valueColor}>{value}</Mono>
      )}
    </View>
  );
}

function Dashes() {
  return (
    <View style={{ marginVertical: 9 }}>
      <DashedRule tint={readingPalette.receiptDash} />
    </View>
  );
}

/** The gold total line, which glows twice once the receipt has printed. */
function Total({ xp }: { xp: number }) {
  const reduced = useReducedMotion();
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const pulse = Animated.sequence([
      Animated.delay(2600),
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
        { iterations: 2 },
      ),
    ]);
    pulse.start();
    return () => pulse.stop();
  }, [glow, reduced]);
  return (
    <View
      accessible
      accessibilityLabel={`Total: mais ${xp} XP`}
      style={{
        marginTop: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: readingPalette.receiptTotal,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -5,
          right: -5,
          top: -5,
          bottom: -5,
          borderRadius: 14,
          borderWidth: 5,
          borderColor: readingPalette.gold,
          opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
        }}
      />
      <Mono bold color={readingPalette.receiptTotalInk}>
        TOTAL
      </Mono>
      <Text
        style={{
          fontFamily: fontFamily.extrabold,
          fontSize: 22,
          lineHeight: 28,
          color: readingPalette.receiptTotalInk,
        }}
      >
        +{xp} XP
      </Text>
    </View>
  );
}

/** Torn paper edge at the bottom of the receipt. */
function Zigzag({ width }: { width: number }) {
  const tooth = 16;
  const count = Math.ceil(width / tooth);
  return (
    <View
      style={{ flexDirection: 'row', height: tooth / 2, overflow: 'hidden', width }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={{
            width: 0,
            height: 0,
            borderTopWidth: tooth / 2,
            borderTopColor: readingPalette.paper,
            borderLeftWidth: tooth / 2,
            borderLeftColor: readingPalette.transparent,
            borderRightWidth: tooth / 2,
            borderRightColor: readingPalette.transparent,
          }}
        />
      ))}
    </View>
  );
}

/** The receipt slides out of the printer slot once its height is known. */
function Printed({ width, children }: { width: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const [height, setHeight] = useState<number | null>(null);
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (height === null) return;
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 2000,
      delay: 500,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [height, progress, reduced]);
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="Recibo de leitura"
      style={{ width, marginTop: -7, overflow: 'hidden', paddingBottom: 6 }}
    >
      <Animated.View
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        style={{
          opacity: height === null ? 0 : 1,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [-(height ?? 0), 0],
              }),
            },
          ],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function Rise({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    const animation = Animated.spring(value, {
      toValue: 1,
      damping: 9,
      stiffness: 140,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [value, reduced]);
  return (
    <Animated.View
      style={{
        opacity: value.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) },
          { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function ConfettiPiece({ index, height }: { index: number; height: number }) {
  const fall = useRef(new Animated.Value(0)).current;
  const duration = 3400 + ((index * 7) % 10) * 250;
  useEffect(() => {
    const animation = Animated.sequence([
      Animated.delay(((index * 13) % 40) * 100),
      Animated.loop(
        Animated.timing(fall, {
          toValue: 1,
          duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ]);
    animation.start();
    return () => animation.stop();
  }, [fall, duration, index]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: -20,
        left: `${(index * 37) % 100}%`,
        width: 8,
        height: 14,
        borderRadius: 2,
        backgroundColor: readingPalette.confetti[index % readingPalette.confetti.length],
        transform: [
          { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-20, height + 40] }) },
          { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '520deg'] }) },
        ],
      }}
    />
  );
}

/** Falling confetti behind everything; absent under reduced motion. */
function Confetti() {
  const reduced = useReducedMotion();
  const { height } = useWindowDimensions();
  if (reduced) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
    >
      {Array.from({ length: 22 }, (_, index) => (
        <ConfettiPiece key={index} index={index} height={height} />
      ))}
    </View>
  );
}
