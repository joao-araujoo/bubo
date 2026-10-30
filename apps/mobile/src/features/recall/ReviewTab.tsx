import { type PracticeCardsResponse, type RecallCard, type StatsResponse } from '@bubo/contracts';
import {
  type DailyStamp,
  buildWidgetMonth,
  hoursUntilNextDay,
  monthlyChallenge,
  stableBucket,
} from '@bubo/domain';
import { reviewXpRange } from '@bubo/scoring';
import { type ComponentProps, type ReactNode, useEffect, useRef } from 'react';
import { Animated, Pressable, View, useWindowDimensions } from 'react-native';

import {
  BuboMascot,
  Button,
  DashedRule,
  Icon,
  Raised,
  SectionTitle,
  Text,
} from '../../design-system';
import { haptics } from '../../lib/haptics';
import { useAmbientLoop, useReducedMotion } from '../../lib/motion';
import { type ColorTokens, coverPalettes, useTheme } from '../../theme';
import { estimatedMinutes } from './grades';

type IconName = ComponentProps<typeof Icon>['name'];

/**
 * Revisar (ADR-045): the stack of today's cards, the daily stamp card, the month challenge and
 * two practice decks. Every number is the reader's real data.
 */

/** A Revisar section: the shared title with quiet meta on the right, then its content. */
export function ReviewSection({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <SectionTitle
        title={title}
        trailing={
          meta ? (
            <Text variant="label" color="textMuted">
              {meta}
            </Text>
          ) : undefined
        }
      />
      {children}
    </View>
  );
}

/** Today's due cards as a fanned stack: the first real prompt on top, Bubo peeking beside it. */
export function ReviewStack({
  first,
  count,
  onStart,
}: {
  first: RecallCard;
  count: number;
  onStart: () => void;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const fan = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      fan.setValue(1);
      return;
    }
    const animation = Animated.spring(fan, {
      toValue: 1,
      damping: 9,
      stiffness: 120,
      delay: 100,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [fan, reduced]);
  const palette = coverPalettes[stableBucket(first.bookTitle, coverPalettes.length)];
  const xp = reviewXpRange(count);
  const behind = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    borderRadius: 22,
    borderWidth: theme.sizes.borderWidth,
    borderColor: theme.colors.borderSoft,
  };

  return (
    <View style={{ gap: 14 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Revisar agora. Primeiro card, de ${first.bookTitle}: ${first.prompt}`}
        onPressIn={() => haptics.press()}
        onPress={onStart}
        style={{ marginHorizontal: 6, paddingTop: theme.spacing.xs, paddingBottom: 22 }}
      >
        <Animated.View
          style={[
            behind,
            {
              top: 22,
              bottom: 0,
              backgroundColor: theme.colors.primarySoft,
              transform: [
                { rotate: fan.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-5deg'] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            behind,
            {
              top: 14,
              bottom: 8,
              backgroundColor: theme.colors.surfaceMuted,
              transform: [
                { rotate: fan.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '3deg'] }) },
              ],
            },
          ]}
        />
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.borderSoft}
          rimColor={theme.colors.cardShadow}
          radius={22}
          depth={theme.sizes.cardRim}
          faceStyle={{ minHeight: 170, padding: 18, gap: 10 }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              maxWidth: '78%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 5,
              paddingHorizontal: 10,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.primarySoft,
            }}
          >
            <View
              style={{
                width: 8,
                height: 12,
                borderTopLeftRadius: 1,
                borderBottomLeftRadius: 1,
                borderTopRightRadius: 2,
                borderBottomRightRadius: 2,
                backgroundColor: palette?.face ?? theme.colors.primary,
              }}
            />
            <Text variant="caption" color="accentDeep" numberOfLines={1} style={{ flexShrink: 1 }}>
              {first.bookTitle}
            </Text>
          </View>
          <Text
            variant="titleSm"
            numberOfLines={3}
            style={{ fontSize: 19, lineHeight: 25, paddingRight: 64 }}
          >
            {first.prompt}
          </Text>
          <Text variant="bodySm" color="textMuted" style={{ marginTop: 'auto' }}>
            1 de {count} · tente lembrar antes de virar
          </Text>
        </Raised>
        <View pointerEvents="none" style={{ position: 'absolute', right: -8, bottom: 8 }}>
          <BuboMascot state="reviewDue" size={96} />
        </View>
      </Pressable>
      <Button
        label={`Revisar ${count === 1 ? '1 card' : `${count} cards`} · ~${estimatedMinutes(count)} min`}
        accessibilityLabel={`Revisar ${count === 1 ? '1 card' : `${count} cards`}, cerca de ${estimatedMinutes(count)} minutos, até ${xp.max} XP`}
        onPress={onStart}
        trailing={
          <View
            style={{
              paddingVertical: 3,
              paddingHorizontal: theme.spacing.sm,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.goldSoft,
            }}
          >
            <Text variant="labelSm" color="warningText">
              até +{xp.max} XP
            </Text>
          </View>
        }
      />
    </View>
  );
}

const STAMP_ICON: Record<DailyStamp['id'], IconName> = {
  focus: 'menu-book',
  recall: 'lightbulb-outline',
  review: 'style',
};

/** The daily stamp card: one stamp per real habit of the day, a seal that counts them. */
export function DayStampCard({
  stamps,
  dueCount,
  onOpen,
}: {
  stamps: readonly DailyStamp[];
  dueCount: number;
  onOpen: (stamp: DailyStamp) => void;
}) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  // Card face minus the seal column (rule + gap + seal) and the gaps between slots.
  const slotsWidth =
    width - 2 * theme.sizes.gutter - 2 * theme.spacing.lg - 2 * theme.sizes.borderWidth - 76;
  const circle = Math.max(46, Math.min(62, Math.floor((slotsWidth - 3 * 6) / stamps.length) - 6));
  const done = stamps.filter((stamp) => stamp.done).length;
  const missing = stamps.filter((stamp) => !stamp.done);
  const label = (stamp: DailyStamp) =>
    stamp.id === 'review' && !stamp.done && dueCount > 0
      ? `Revisar ${dueCount === 1 ? '1 card' : `${dueCount} cards`}`
      : stamp.label;
  const notch = {
    position: 'absolute' as const,
    top: '50%' as const,
    marginTop: -11,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.bg,
    borderWidth: theme.sizes.borderWidth,
    borderColor: theme.colors.borderSoft,
  };

  return (
    <ReviewSection title="Cartela do dia" meta={`renova em ${hoursUntilNextDay(new Date())}h`}>
      <Raised
        faceColor={theme.colors.surface}
        borderColor={theme.colors.borderSoft}
        rimColor={theme.colors.cardShadow}
        radius={22}
        depth={theme.sizes.cardRim}
        faceStyle={{
          paddingTop: theme.spacing.lg,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: 14,
        }}
      >
        <View style={[notch, { left: -12 }]} />
        <View style={[notch, { right: -12 }]} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 6,
          }}
        >
          {stamps.map((stamp, index) => (
            <StampSlot
              key={stamp.id}
              stamp={stamp}
              label={label(stamp)}
              index={index}
              size={circle}
              onPress={() => onOpen(stamp)}
            />
          ))}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <DashedRule vertical />
            <Seal done={done} total={stamps.length} />
          </View>
        </View>
        <View style={{ marginTop: theme.spacing.md, gap: 10 }}>
          <DashedRule />
          <Text variant="bodyStrong" color="textMuted" accessibilityLiveRegion="polite">
            {missing.length === 0
              ? 'Cartela fechada! Amanhã tem outra.'
              : `${missing.length === 1 ? 'Falta 1 carimbo' : `Faltam ${missing.length} carimbos`}: ${missing
                  .map((stamp) => label(stamp).toLowerCase())
                  .join(' e ')}.`}
          </Text>
        </View>
      </Raised>
    </ReviewSection>
  );
}

function StampSlot({
  stamp,
  label,
  index,
  size,
  onPress,
}: {
  stamp: DailyStamp;
  label: string;
  index: number;
  size: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const ink = useRef(new Animated.Value(stamp.done && !reduced ? 0 : 1)).current;
  useEffect(() => {
    if (!stamp.done || reduced) {
      ink.setValue(1);
      return;
    }
    ink.setValue(0);
    const animation = Animated.sequence([
      Animated.delay(200 + index * 250),
      Animated.spring(ink, { toValue: 1, damping: 9, stiffness: 200, useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [ink, stamp.done, reduced, index]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${stamp.done ? 'carimbado' : 'ainda não'}`}
      accessibilityHint={stamp.done ? undefined : 'Abre esta atividade'}
      accessibilityState={{ disabled: stamp.done }}
      disabled={stamp.done}
      onPressIn={() => haptics.press()}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: theme.sizes.touchTarget,
        alignItems: 'center',
        gap: 6,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {stamp.done ? (
        <Animated.View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 3,
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: ink,
            transform: [
              { scale: ink.interpolate({ inputRange: [0, 1], outputRange: [1.8, 1] }) },
              {
                rotate: ink.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '-12deg'] }),
              },
            ],
          }}
        >
          <Icon name={STAMP_ICON[stamp.id]} size={Math.round(size * 0.45)} color="accentText" />
        </Animated.View>
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2.5,
            borderStyle: 'dashed',
            borderColor: theme.colors.secondaryRim,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={STAMP_ICON[stamp.id]} size={Math.round(size * 0.42)} color="textMuted" />
        </View>
      )}
      <Text variant="labelSm" align="center" color={stamp.done ? 'accentDeep' : 'textMuted'}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Gold seal (two squares make the starburst) counting the day's stamps. */
function Seal({ done, total }: { done: number; total: number }) {
  const theme = useTheme();
  const complete = done === total;
  const wiggle = useAmbientLoop(2400, complete, 0.5);
  const square = {
    position: 'absolute' as const,
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: theme.sizes.borderWidth,
    borderColor: theme.colors.goldRim,
    backgroundColor: theme.colors.gold,
  };
  return (
    <View
      accessible
      accessibilityLabel={complete ? 'Cartela fechada' : `${done} de ${total} carimbos`}
      style={{ width: 66, alignItems: 'center', gap: 6 }}
    >
      <Animated.View
        style={{
          width: 62,
          height: 62,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [
            { rotate: wiggle.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) },
          ],
        }}
      >
        <View style={square} />
        <View style={[square, { transform: [{ rotate: '45deg' }] }]} />
        {complete ? (
          <Icon name="check" size={26} color="onAccentTile" />
        ) : (
          <Text variant="labelLg" color="onAccentTile">
            {done}/{total}
          </Text>
        )}
      </Animated.View>
      <Text variant="labelSm" align="center" color={complete ? 'warningText' : 'textMuted'}>
        {complete ? 'fechada!' : 'carimbos'}
      </Text>
    </View>
  );
}

const CHALLENGE_COLUMNS = 16;
const CHALLENGE_GAP = 4;

/** "Desafio do mês": active days (reading or review) of this month against a target. */
export function MonthChallengeCard({ stats }: { stats: StatsResponse }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const month = buildWidgetMonth(
    stats.today,
    new Set(stats.monthActiveDates),
    new Set(stats.streakFreeze.frozenDates),
  );
  const challenge = monthlyChallenge(stats.today, stats.monthActiveDates);
  const inner = width - 2 * theme.sizes.gutter - 2 * theme.spacing.lg - 2 * theme.sizes.borderWidth;
  // One point of slack so rounding never pushes the 16th square to a new row.
  const square = Math.floor(
    (inner - 1 - (CHALLENGE_COLUMNS - 1) * CHALLENGE_GAP) / CHALLENGE_COLUMNS,
  );
  const caption = challenge.completed
    ? 'Desafio do mês cumprido. Leitura e revisão contam.'
    : challenge.reachable
      ? `Faltam ${challenge.target - challenge.activeDays} dias e restam ${challenge.available} no mês. Leitura ou revisão contam.`
      : 'Este mês não fecha mais o desafio, mas cada dia ainda conta na sequência.';
  const dayColor = (day: (typeof month.days)[number]): keyof ColorTokens =>
    day.active ? 'primary' : day.frozen ? 'blue' : day.future ? 'surfaceMuted' : 'border';

  return (
    <ReviewSection title={`Desafio de ${month.label.toLowerCase()}`}>
      <Raised
        faceColor={theme.colors.surface}
        borderColor={theme.colors.borderSoft}
        rimColor={theme.colors.cardShadow}
        radius={theme.radii.card}
        depth={theme.sizes.cardRim}
        faceStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: theme.colors.purpleLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="auto-stories" size={24} color="onPrimary" />
            </View>
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <Text variant="titleSm" style={{ fontSize: 17 }}>
              Ativo em {challenge.target} dias do mês
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
                paddingVertical: 3,
                paddingHorizontal: 10,
                borderRadius: theme.radii.pill,
                backgroundColor: challenge.completed
                  ? theme.colors.successSoft
                  : theme.colors.primarySoft,
              }}
            >
              <Text variant="labelSm" color={challenge.completed ? 'successText' : 'accentText'}>
                {challenge.completed
                  ? `Concluído · ${challenge.activeDays} de ${challenge.target}`
                  : `${challenge.activeDays} de ${challenge.target} dias`}
              </Text>
            </View>
          </View>
        </View>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`${challenge.activeDays} dias ativos em ${month.label.toLowerCase()}`}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: CHALLENGE_GAP }}
        >
          {month.days.map((day) => (
            <View
              key={day.day}
              style={{
                width: square,
                height: square,
                borderRadius: 4,
                backgroundColor: theme.colors[dayColor(day)],
                borderWidth: day.today ? 2 : 0,
                borderColor: theme.colors.gold,
              }}
            />
          ))}
        </View>
        <Text variant="bodySm" color="textMuted">
          {caption}
        </Text>
      </Raised>
    </ReviewSection>
  );
}

/** The two practice decks. Practising never grades, reschedules or awards XP. */
export function TrainingTiles({
  practice,
  failed,
  onOpen,
}: {
  practice: PracticeCardsResponse | undefined;
  /** The decks could not be loaded (offline, or an API without the practice route). */
  failed: boolean;
  onOpen: (mode: 'escaparam' | 'relampago') => void;
}) {
  const theme = useTheme();
  const slipped = practice?.slipped.length ?? 0;
  const lightning = practice?.lightning.length ?? 0;
  return (
    <ReviewSection title="Treinos">
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <TrainingTile
          icon="replay"
          face="errorSoft"
          tint="error"
          title="Cards que escaparam"
          subtitle={
            practice === undefined
              ? failed
                ? 'Indisponível agora'
                : 'Carregando…'
              : slipped > 0
                ? `${slipped} ${slipped === 1 ? 'marcado' : 'marcados'} como "esqueci"`
                : 'Nenhum escapou nos últimos 30 dias'
          }
          disabled={slipped === 0}
          onPress={() => onOpen('escaparam')}
        />
        <TrainingTile
          icon="timer"
          face="blueSoft"
          tint="blue"
          title="Relâmpago de 60s"
          subtitle={
            practice === undefined
              ? failed
                ? 'Indisponível agora'
                : 'Carregando…'
              : lightning > 0
                ? 'Quantos você lembra em 1 minuto?'
                : 'Libera depois da sua primeira revisão'
          }
          disabled={lightning === 0}
          onPress={() => onOpen('relampago')}
        />
      </View>
      <Text variant="bodySm" color="textMuted">
        Treinos não mudam sua agenda de revisões nem dão XP.
      </Text>
    </ReviewSection>
  );
}

function TrainingTile({
  icon,
  face,
  tint,
  title,
  subtitle,
  disabled,
  onPress,
}: {
  icon: IconName;
  face: keyof ColorTokens;
  tint: keyof ColorTokens;
  title: string;
  subtitle: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => haptics.press()}
      onPress={onPress}
      style={{ flex: 1, opacity: disabled ? 0.6 : 1 }}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.surface}
          borderColor={theme.colors.borderSoft}
          rimColor={theme.colors.cardShadow}
          radius={22}
          depth={theme.sizes.cardRim}
          pressed={pressed && !disabled}
          faceStyle={{ padding: 14, gap: theme.spacing.sm, minHeight: 150 }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors[face],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={22} color={tint} />
          </View>
          <Text variant="label" style={{ fontSize: 15, lineHeight: 20 }}>
            {title}
          </Text>
          <Text variant="bodySm" color="textMuted">
            {subtitle}
          </Text>
        </Raised>
      )}
    </Pressable>
  );
}
