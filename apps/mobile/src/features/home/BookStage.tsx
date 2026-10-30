import { type ShelfEntry } from '@bubo/contracts';
import {
  coverUrlForWidth,
  GREETING_BY_PERIOD,
  greetingPeriod,
  nextReadingMilestone,
  readingProgress,
  stableBucket,
} from '@bubo/domain';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Book3D, BuboLogo, BuboMascot, Icon, Raised, Text } from '../../design-system';
import { haptics } from '../../lib/haptics';
import { coverPalettes, useTheme } from '../../theme';
import { NotificationBell } from '../notifications/NotificationBell';
import { ProfileButton } from '../shell/ProfileButton';

/** Space the stage leaves at its bottom for the day tiles that overlap it. */
export const STAGE_OVERLAP = 46;

/**
 * Hoje's book stage (ADR-043): full-bleed at the top, painted with the current book's own cover,
 * blurred and darkened, so its colours follow every book. Without a cover image it uses the same
 * palette as the typographic cover; without a book, the brand violet.
 */
export function BookStage({
  entry,
  header,
  greeting,
  children,
}: {
  entry: ShelfEntry | null;
  header: ReactNode;
  greeting: ReactNode;
  children: ReactNode;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const cover = entry?.book.coverUrls[0];
  const fallback = entry
    ? (coverPalettes[stableBucket(entry.book.title, coverPalettes.length)]?.face ??
      theme.colors.heroStart)
    : theme.colors.heroStart;
  return (
    <View
      style={{
        overflow: 'hidden',
        backgroundColor: fallback,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
        paddingTop: insets.top + theme.spacing.sm,
        paddingHorizontal: theme.sizes.gutter,
        paddingBottom: STAGE_OVERLAP + theme.spacing.xl,
        gap: theme.spacing.lg,
      }}
    >
      {cover ? (
        <Image
          source={{ uri: coverUrlForWidth(cover, 60) }}
          blurRadius={40}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={theme.motion.base}
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.stageVeil }]}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -90,
          top: -70,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: theme.colors.heroGlow,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -60,
          bottom: -70,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: theme.colors.heroGlowSoft,
        }}
      />
      {header}
      {greeting}
      {children}
    </View>
  );
}

/** Glass counter on the stage (streak, XP). */
function StageChip({
  icon,
  iconColor,
  label,
  accessibilityLabel,
}: {
  icon: ComponentProps<typeof Icon>['name'];
  iconColor: ComponentProps<typeof Icon>['color'];
  label: string;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        height: 38,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radii.pill,
        borderWidth: 1.5,
        borderColor: theme.colors.stageGlassBorder,
        backgroundColor: theme.colors.stageGlass,
      }}
    >
      <Icon name={icon} size={18} color={iconColor} />
      <Text variant="label" color="onPrimary">
        {label}
      </Text>
    </View>
  );
}

/** Stage header: official symbol, streak + XP, notifications and the profile avatar. */
export function StageHeader({
  userId,
  streakDays,
  xp,
}: {
  userId: string;
  /** `null` until the reader has real activity (never invented). */
  streakDays: number | null;
  xp: number | null;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
      <View style={{ flex: 1 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.stageButton,
          }}
        >
          <BuboLogo variant="symbol" height={26} />
        </View>
      </View>
      <StageChip
        icon="local-fire-department"
        iconColor="orange"
        label={streakDays === null ? '–' : String(streakDays)}
        accessibilityLabel={
          streakDays === null ? 'Sequência: ainda sem dados' : `Sequência de ${streakDays} dias`
        }
      />
      <StageChip
        icon="star"
        iconColor="gold"
        label={xp === null ? '–' : String(xp)}
        accessibilityLabel={xp === null ? 'XP: ainda sem dados' : `${xp} pontos de experiência`}
      />
      <NotificationBell userId={userId} />
      <ProfileButton />
    </View>
  );
}

/** One-line greeting for the local hour, with a real-data subtitle. */
export function StageGreeting({ name, subtitle }: { name: string; subtitle: string | null }) {
  const theme = useTheme();
  const first = name.trim().split(/\s+/)[0] || name;
  const part = GREETING_BY_PERIOD[greetingPeriod(new Date().getHours())];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <Text
          variant="heading"
          color="onPrimary"
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          style={{ fontSize: 26 }}
        >
          <Text variant="heading" color="onHeroMuted" style={{ fontSize: 26 }}>
            {part},
          </Text>{' '}
          {first}
        </Text>
        {subtitle ? (
          <Text variant="bodySm" color="onHeroMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <BuboMascot state="focusSession" size={72} />
    </View>
  );
}

const MILESTONE_LABEL = {
  25: 'pra um quarto do livro',
  50: 'pra metade',
  75: 'pra três quartos',
  100: 'pro fim',
} as const;

/** White pushdown button for the stage. */
export function StageButton({
  label,
  icon,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon: ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPressIn={() => haptics.commit()}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.stageButton}
          borderColor={theme.colors.stageButton}
          rimColor={theme.colors.stageButtonRim}
          radius={theme.radii.card}
          depth={theme.sizes.rim}
          pressed={pressed}
          faceStyle={{
            minHeight: theme.sizes.ctaHeight,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
          }}
        >
          <Icon name={icon} size={24} color="onStageButton" />
          <Text variant="labelLg" color="onStageButton">
            {label}
          </Text>
        </Raised>
      )}
    </Pressable>
  );
}

/** Glass secondary button for the stage. */
function StageGlassButton({
  label,
  icon,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon: ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => haptics.press()}
      onPress={onPress}
      style={({ pressed }) => ({
        minWidth: 76,
        minHeight: theme.sizes.ctaHeight,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radii.card,
        borderWidth: 1.5,
        borderColor: theme.colors.stageGlassBorder,
        backgroundColor: theme.colors.stageGlass,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Icon name={icon} size={22} color="onPrimary" />
      <Text variant="label" color="onPrimary">
        {label}
      </Text>
    </Pressable>
  );
}

/** The current book on the stage: 3D object, progress to the next milestone and the actions. */
export function StageBook({
  entry,
  returning,
  onStart,
}: {
  entry: ShelfEntry;
  /** Days away when the reader is coming back after a pause (ADR-032), else null. */
  returning: number | null;
  onStart: (fiveMinutes: boolean) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const progress = readingProgress(entry.currentPage, entry.book.totalPages ?? 0);
  const milestone = nextReadingMilestone(entry.currentPage, entry.book.totalPages ?? 0);
  const openBook = () => {
    haptics.selection();
    router.push({ pathname: '/livro/[id]', params: { id: entry.id } });
  };
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.lg }}>
        <Book3D
          title={entry.book.title}
          author={entry.book.author}
          coverUrls={entry.book.coverUrls}
          totalPages={entry.book.totalPages}
          width={112}
          priority="high"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${entry.book.title}`}
          onPress={openBook}
          style={{ flex: 1, gap: theme.spacing.xxs, paddingBottom: theme.spacing.xs }}
        >
          <Text variant="caption" color="gold">
            {returning !== null ? `Pausado há ${returning} dias` : 'Lendo agora'}
          </Text>
          <Text variant="heading" color="onPrimary" numberOfLines={3}>
            {entry.book.title}
          </Text>
          {entry.book.author ? (
            <Text variant="bodySm" color="onHeroMuted" numberOfLines={1}>
              {entry.book.author}
            </Text>
          ) : null}
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: theme.spacing.xs,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
              borderRadius: theme.radii.pill,
              borderWidth: 1.5,
              borderColor: theme.colors.stageGlassBorder,
              backgroundColor: theme.colors.stageGlass,
            }}
          >
            <Text variant="label" color="onPrimary">
              {progress.totalPages > 0
                ? `Pág. ${progress.currentPage} de ${progress.totalPages}`
                : `Pág. ${progress.currentPage}`}
            </Text>
          </View>
        </Pressable>
      </View>

      {progress.totalPages > 0 ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={`Progresso de leitura: ${progress.percent}%`}
            accessibilityValue={{ min: 0, max: 100, now: progress.percent }}
            style={{ height: 14, borderRadius: 7, backgroundColor: theme.colors.stageTrack }}
          >
            <View
              style={{
                width: `${progress.percent}%`,
                height: 14,
                borderRadius: 7,
                backgroundColor: theme.colors.gold,
              }}
            />
            {milestone ? (
              <View
                style={{
                  position: 'absolute',
                  left: `${milestone.percent}%`,
                  top: -6,
                  marginLeft: -13,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  borderWidth: 3,
                  borderColor: theme.colors.gold,
                  backgroundColor: theme.colors.stageButton,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="flag" size={13} color="goldRim" />
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="label" color="gold">
              {progress.percent}%
            </Text>
            {milestone ? (
              <Text variant="label" color="onHeroMuted">
                {milestone.pagesLeft === 1
                  ? `falta 1 pág. ${MILESTONE_LABEL[milestone.percent]}`
                  : `faltam ${milestone.pagesLeft} pág. ${MILESTONE_LABEL[milestone.percent]}`}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <StageButton
          label={returning !== null ? 'Voltar com 5 minutos' : 'Continuar leitura'}
          icon={returning !== null ? 'timer' : 'play-arrow'}
          onPress={() => onStart(returning !== null)}
        />
        <StageGlassButton
          label={returning !== null ? 'Sem meta' : '5 min'}
          icon={returning !== null ? 'play-arrow' : 'timer'}
          accessibilityLabel={returning !== null ? 'Começar sem meta de tempo' : 'Ler só 5 minutos'}
          onPress={() => onStart(returning === null)}
        />
      </View>
    </View>
  );
}

/** A message on the stage (loading, retry, choose a book, reviews without a book). */
export function StageMessage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xxs }}>
        <Text variant="title" color="onPrimary">
          {title}
        </Text>
        {description ? (
          <Text variant="body" color="onHeroMuted">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}
