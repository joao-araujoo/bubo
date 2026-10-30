import { type AchievementsResponse, type StatsResponse } from '@bubo/contracts';
import { WEEKDAY_LETTERS_PT, buildWidgetMonth, streakMilestones } from '@bubo/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type MascotPose } from '../../assets/registry';
import { BuboMascot, Icon, Text } from '../../design-system';
import { useAmbientLoop, useReducedMotion } from '../../lib/motion';
import { fontFamily, readingPalette, useTheme } from '../../theme';
import { SceneButton, SceneIconButton, Stars } from './scene';

function recordLine(streak: number, longest: number | null) {
  if (streak === 0) return 'Leia ou revise hoje para acender a chama.';
  if (longest === null) return 'Contam os dias com leitura ou revisão.';
  if (streak >= longest) return 'Você está no seu recorde!';
  return `Seu recorde é ${longest}. Faltam ${longest - streak} pra igualar.`;
}

function protectionLine(stats: StatsResponse, frozenDays: number[]) {
  const { available, max, earnEvery, progress } = stats.streakFreeze;
  const left =
    available === 0
      ? 'Nenhuma guardada agora.'
      : available === 1
        ? 'Ainda resta 1.'
        : `Ainda restam ${available}.`;
  const last = frozenDays[frozenDays.length - 1];
  if (last !== undefined) return `Dia ${last} foi salvo por uma proteção. ${left}`;
  if (available >= max) return `Você tem ${available} proteções guardadas, o máximo.`;
  if (available > 0)
    return `Você tem ${available === 1 ? '1 proteção guardada' : `${available} proteções guardadas`} pra um dia corrido.`;
  const missing = Math.max(1, earnEvery - progress);
  return `Mais ${missing} ${missing === 1 ? 'dia seguido' : 'dias seguidos'} e você ganha uma proteção.`;
}

/**
 * "Dias seguidos" (ADR-044): the current streak on a starry night, this month's calendar with
 * runs of consecutive days and protected days, and the next milestones. Derived from
 * `/v1/me/stats` and `/v1/me/achievements` only (ADR-014/029).
 */
export function StreakNight({
  stats,
  achievements,
  onClose,
}: {
  stats: StatsResponse;
  achievements: AchievementsResponse | undefined;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const streak = stats.streakDays;
  const longest = achievements?.longestStreakDays ?? null;
  const month = buildWidgetMonth(
    stats.today,
    new Set(stats.monthActiveDates),
    new Set(stats.streakFreeze.frozenDates),
  );
  const activeCount = month.days.filter((day) => day.active).length;
  const frozenDays = month.days.filter((day) => day.frozen).map((day) => day.day);
  const activeToday = stats.readToday || stats.reviewedToday;
  const pose: MascotPose = streak === 0 ? 'sleeping' : activeToday ? 'happy' : 'worried';
  const marks = streakMilestones(streak, longest ?? streak);
  const flame = useAmbientLoop(1600, true, 0.5);
  const cells: ({ id: string } & (
    { blank: true } | ({ blank: false } & (typeof month.days)[number])
  ))[] = [
    ...Array.from({ length: month.offset }, (_, index) => ({
      id: `lead-${index}`,
      blank: true as const,
    })),
    ...month.days.map((day) => ({ id: `day-${day.day}`, blank: false as const, ...day })),
  ];
  while (cells.length % 7 !== 0) cells.push({ id: `tail-${cells.length}`, blank: true });
  const weeks = Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );

  return (
    <View style={{ flex: 1, backgroundColor: readingPalette.night }}>
      <LinearGradient
        colors={[readingPalette.night, readingPalette.nightEnd]}
        style={StyleSheet.absoluteFill}
      />
      <Stars />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + theme.spacing.sm,
          paddingBottom: theme.spacing.lg,
        }}
      >
        <View style={{ paddingHorizontal: theme.spacing.md }}>
          <SceneIconButton icon="close" label="Fechar" onPress={onClose} />
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            paddingHorizontal: theme.spacing.xl - theme.spacing.xs,
            paddingTop: theme.spacing.sm,
          }}
        >
          <View style={{ flex: 1 }}>
            <CountUp>
              <View
                accessible
                accessibilityRole="header"
                accessibilityLabel={`${streak} ${streak === 1 ? 'dia seguido' : 'dias seguidos'}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        scale: flame.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }),
                      },
                      {
                        rotate: flame.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['-3deg', '3deg'],
                        }),
                      },
                    ],
                  }}
                >
                  <Icon
                    name="local-fire-department"
                    size={62}
                    tint={streak === 0 ? readingPalette.nightMuted : readingPalette.flame}
                  />
                </Animated.View>
                <Text
                  style={{
                    fontFamily: fontFamily.black,
                    fontSize: 84,
                    lineHeight: 92,
                    letterSpacing: -3,
                    color: readingPalette.gold,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {streak}
                </Text>
              </View>
            </CountUp>
            <Text
              variant="heading"
              style={{ color: readingPalette.nightText, fontSize: 22, lineHeight: 28 }}
            >
              {streak === 1 ? 'dia seguido' : 'dias seguidos'}
            </Text>
            <Text variant="bodyStrong" style={{ color: readingPalette.nightMuted }}>
              {recordLine(streak, longest)}
            </Text>
          </View>
          <BuboMascot pose={pose} size={118} decorative={false} />
        </View>

        <View
          accessibilityLabel={`Calendário de ${month.label.toLowerCase()}`}
          style={{
            marginHorizontal: theme.sizes.gutter,
            marginTop: theme.spacing.xl - theme.spacing.xs,
            paddingTop: 14,
            paddingHorizontal: theme.spacing.md,
            paddingBottom: theme.spacing.md,
            borderRadius: 22,
            borderWidth: 1.5,
            borderColor: readingPalette.glassBorder,
            backgroundColor: readingPalette.glass,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              paddingHorizontal: theme.spacing.xs,
              paddingBottom: theme.spacing.sm,
            }}
          >
            <Text variant="titleSm" style={{ color: readingPalette.nightText, fontSize: 17 }}>
              {month.label}
            </Text>
            <Text variant="label" style={{ color: readingPalette.gold, fontSize: 13 }}>
              {activeCount} {activeCount === 1 ? 'dia ativo' : 'dias ativos'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', paddingBottom: theme.spacing.xs }}>
            {WEEKDAY_LETTERS_PT.map((letter, index) => (
              <Text
                key={`${letter}-${index}`}
                variant="label"
                align="center"
                style={{ flex: 1, fontSize: 11, color: readingPalette.nightMuted }}
              >
                {letter}
              </Text>
            ))}
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            {weeks.map((week, row) => (
              <View key={row} style={{ flexDirection: 'row' }}>
                {week.map((cell) =>
                  cell.blank ? (
                    <View key={cell.id} style={{ flex: 1, height: 38 }} />
                  ) : (
                    <DayCell key={cell.id} {...cell} monthLabel={month.label} />
                  ),
                )}
              </View>
            ))}
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              marginTop: 10,
              paddingVertical: theme.spacing.sm,
              paddingHorizontal: 10,
              borderRadius: 14,
              backgroundColor: readingPalette.freezeWash,
            }}
          >
            <Icon name="ac-unit" size={20} tint={readingPalette.freezeIcon} />
            <Text
              variant="label"
              style={{ flex: 1, color: readingPalette.freezeText, fontSize: 13 }}
            >
              {protectionLine(stats, frozenDays)}
            </Text>
          </View>
        </View>

        <View
          accessibilityLabel="Próximos marcos"
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 22,
            paddingTop: 18,
          }}
        >
          {marks.map((mark) => {
            const done = mark.state === 'done';
            const next = mark.state === 'next';
            return (
              <View
                key={mark.days}
                accessible
                accessibilityLabel={
                  done
                    ? `Marco de ${mark.days} dias: feito`
                    : `Marco de ${mark.days} dias: faltam ${mark.daysLeft}`
                }
                style={{ alignItems: 'center', gap: theme.spacing.xs }}
              >
                <View
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    borderWidth: 3,
                    borderColor: done
                      ? readingPalette.goldRim
                      : next
                        ? readingPalette.gold
                        : readingPalette.glassBorder,
                    backgroundColor: done
                      ? readingPalette.gold
                      : next
                        ? readingPalette.milestoneNext
                        : readingPalette.glass,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    variant="labelLg"
                    style={{
                      color: done
                        ? readingPalette.onGold
                        : next
                          ? readingPalette.gold
                          : readingPalette.dayFuture,
                    }}
                  >
                    {mark.days}
                  </Text>
                </View>
                <Text
                  variant="label"
                  style={{
                    fontSize: 11,
                    color: done
                      ? readingPalette.gold
                      : next
                        ? readingPalette.nightText
                        : readingPalette.nightMuted,
                  }}
                >
                  {done ? 'feito' : next ? `faltam ${mark.daysLeft}` : `${mark.days} dias`}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View
        style={{
          paddingHorizontal: theme.sizes.gutter,
          paddingTop: theme.spacing.sm,
          paddingBottom: insets.bottom + theme.spacing.lg,
        }}
      >
        <SceneButton variant="gold" label="Continuar" onPress={onClose} />
      </View>
    </View>
  );
}

function DayCell({
  day,
  active,
  frozen,
  today,
  future,
  run,
  monthLabel,
}: ReturnType<typeof buildWidgetMonth>['days'][number] & { monthLabel: string }) {
  const band = run === 'middle' || run === 'start' || run === 'end';
  return (
    <View
      accessible
      accessibilityLabel={`${day} de ${monthLabel.toLowerCase()}${
        frozen ? ', protegido' : active ? ', ativo' : future ? '' : ', sem atividade'
      }${today ? ', hoje' : ''}`}
      style={{ flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' }}
    >
      {band ? (
        <View
          style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            left: run === 'start' ? '50%' : 0,
            right: run === 'end' ? '50%' : 0,
            backgroundColor: readingPalette.run,
          }}
        />
      ) : null}
      <TodayPop today={today}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: frozen
              ? readingPalette.freeze
              : active
                ? readingPalette.flame
                : readingPalette.transparent,
            borderWidth: today ? 2 : 0,
            borderColor: readingPalette.gold,
          }}
        >
          <Text
            variant="label"
            style={{
              fontSize: 13,
              color:
                active || frozen
                  ? readingPalette.paperInk
                  : future
                    ? readingPalette.dayFuture
                    : readingPalette.dayPast,
            }}
          >
            {day}
          </Text>
        </View>
      </TodayPop>
    </View>
  );
}

function TodayPop({ today, children }: { today: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(today && !reduced ? 0 : 1)).current;
  useEffect(() => {
    if (!today || reduced) return;
    const animation = Animated.sequence([
      Animated.delay(600),
      Animated.spring(pop, { toValue: 1, damping: 8, stiffness: 160, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [pop, today, reduced]);
  return <Animated.View style={{ transform: [{ scale: pop }] }}>{children}</Animated.View>;
}

function CountUp({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    const animation = Animated.spring(value, {
      toValue: 1,
      damping: 10,
      stiffness: 120,
      delay: 200,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [value, reduced]);
  return (
    <Animated.View
      style={{
        opacity: value.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
