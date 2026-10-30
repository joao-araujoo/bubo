import { type DailyStamp, readingProgress, type WeekDay } from '@bubo/domain';
import { type Href, useRouter } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Avatar,
  BookCover,
  BuboMascot,
  Icon,
  ProgressRing,
  Raised,
  SectionTitle,
  Text,
} from '../../design-system';
import { useCatalogDiscover, useFriendsFeed } from '../../lib/api/queries';
import { haptics } from '../../lib/haptics';
import { type ColorTokens, useTheme } from '../../theme';
import { STAGE_OVERLAP } from './BookStage';

/** Hoje sections (ADR-043): every number comes from the reader's real data. */

function PressCard({
  href,
  onPress,
  accessibilityLabel,
  face = 'surface',
  rim = 'cardShadow',
  border = 'borderSoft',
  flex,
  height,
  padding,
  children,
}: {
  href?: Href;
  onPress?: () => void;
  accessibilityLabel: string;
  face?: keyof ColorTokens;
  rim?: keyof ColorTokens;
  border?: keyof ColorTokens;
  flex?: boolean;
  height?: number;
  padding?: number;
  children: ReactNode;
}) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => haptics.press()}
      onPress={() => {
        if (onPress) onPress();
        else if (href) router.push(href);
      }}
      style={flex ? { flex: 1 } : undefined}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors[face]}
          borderColor={theme.colors[border]}
          rimColor={theme.colors[rim]}
          radius={theme.radii.card}
          depth={theme.sizes.cardRim}
          pressed={pressed}
          faceStyle={{
            height,
            padding: padding ?? theme.spacing.md,
            gap: theme.spacing.sm,
            justifyContent: 'space-between',
          }}
        >
          {children}
        </Raised>
      )}
    </Pressable>
  );
}

/** The three day tiles that overlap the stage: today's goal, the streak and due reviews. */
export function DayTiles({
  focusedMinutesToday,
  goalMinutes,
  streakDays,
  week,
  dueCount,
  onGoal,
}: {
  focusedMinutesToday: number | null;
  goalMinutes: number | null;
  streakDays: number | null;
  week: readonly WeekDay[];
  dueCount: number | null;
  onGoal: () => void;
}) {
  const theme = useTheme();
  const minutes = focusedMinutesToday ?? 0;
  const done = goalMinutes !== null && minutes >= goalMinutes;
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.sizes.gutter,
        marginTop: -STAGE_OVERLAP,
      }}
    >
      <PressCard
        flex
        height={150}
        onPress={onGoal}
        accessibilityLabel={
          goalMinutes
            ? `Meta do dia: ${minutes} de ${goalMinutes} minutos`
            : `${minutes} minutos de foco hoje`
        }
      >
        <Text variant="caption" color="accentDeep">
          Meta do dia
        </Text>
        <View style={{ alignItems: 'center' }}>
          <ProgressRing
            size={62}
            stroke={9}
            progress={goalMinutes ? minutes / goalMinutes : 0}
            color={done ? 'success' : 'primary'}
            accessibilityLabel={
              goalMinutes ? `${minutes} de ${goalMinutes} minutos` : `${minutes} minutos`
            }
          >
            <Text variant="titleSm">{focusedMinutesToday === null ? '–' : String(minutes)}</Text>
          </ProgressRing>
        </View>
        <Text variant="label" color="textMuted" align="center">
          {goalMinutes === null ? 'min hoje' : done ? 'cumprida!' : `de ${goalMinutes} min`}
        </Text>
      </PressCard>

      <PressCard
        flex
        height={150}
        href="/sequencia"
        face="orange"
        border="orange"
        rim="orangeRim"
        accessibilityLabel={
          streakDays === null ? 'Sequência ainda sem dados' : `Sequência de ${streakDays} dias`
        }
      >
        <Text variant="caption" color="onAccentTile">
          Sequência
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xxs }}>
          <Icon name="local-fire-department" size={30} color="stageButton" />
          <Text variant="display" color="onAccentTile">
            {streakDays === null ? '–' : String(streakDays)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 3 }}>
          {week.map((day) => {
            const lit = day.state === 'done' || day.state === 'today_done';
            const today = day.state === 'today' || day.state === 'today_done';
            return (
              <View
                key={day.isoDate}
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: lit
                    ? theme.colors.stageButton
                    : today
                      ? theme.colors.goldSoft
                      : theme.colors.tileFaint,
                  borderWidth: today ? 1.5 : 0,
                  borderColor: theme.colors.stageButton,
                }}
              />
            );
          })}
        </View>
      </PressCard>

      <PressCard
        flex
        height={150}
        href="/revisar"
        face="success"
        border="success"
        rim="successRim"
        accessibilityLabel={
          dueCount === null
            ? 'Revisões carregando'
            : dueCount === 0
              ? 'Revisões em dia'
              : `${dueCount} ${dueCount === 1 ? 'card' : 'cards'} para revisar`
        }
      >
        <Text variant="caption" color="onAccentTile">
          Revisar
        </Text>
        {dueCount === 0 ? (
          <Icon name="check-circle" size={40} color="onAccentTile" />
        ) : (
          <Text variant="display" color="onAccentTile" style={{ fontSize: 38, lineHeight: 42 }}>
            {dueCount === null ? '–' : String(dueCount)}
          </Text>
        )}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text variant="label" color="onAccentTile">
            {dueCount === 0 ? 'em dia' : 'cards hoje'}
          </Text>
          <Icon name="chevron-right" size={20} color="onAccentTile" />
        </View>
      </PressCard>
    </View>
  );
}

/** The daily card as a ticket: one stamp per real habit of the day (Revisar). */
export function DailyTicket({
  stamps,
  onPress,
}: {
  stamps: readonly DailyStamp[];
  /** Defaults to opening Revisar, where the full stamp card lives. */
  onPress?: () => void;
}) {
  const theme = useTheme();
  const done = stamps.filter((stamp) => stamp.done).length;
  const missing = stamps.length - done;
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
    <PressCard
      href="/revisar"
      onPress={onPress}
      accessibilityLabel={`Cartela do dia: ${done} de ${stamps.length} carimbos`}
    >
      <View style={[notch, { left: -12 }]} />
      <View style={[notch, { right: -12 }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: theme.spacing.xxs }}>
          <Text variant="caption" color="accentDeep">
            Cartela do dia
          </Text>
          <Text variant="titleSm">
            {missing === 0
              ? 'Cartela completa!'
              : missing === 1
                ? 'Falta 1 carimbo'
                : `Faltam ${missing} carimbos`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs }}>
          {stamps.map((stamp, index) => (
            <View
              key={stamp.id}
              accessible
              accessibilityLabel={`${stamp.label}: ${stamp.done ? 'feito' : 'ainda não'}`}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                borderWidth: stamp.done ? 3 : 2.5,
                borderStyle: stamp.done ? 'solid' : 'dashed',
                borderColor: stamp.done ? theme.colors.primary : theme.colors.border,
                backgroundColor: stamp.done ? theme.colors.primarySoft : theme.colors.transparent,
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotate: stamp.done ? (index % 2 ? '9deg' : '-12deg') : '0deg' }],
              }}
            >
              {stamp.done ? <Icon name="check" size={20} color="accentText" /> : null}
            </View>
          ))}
        </View>
      </View>
    </PressCard>
  );
}

/** "Pra você hoje": the first real recommendation of Descobrir, with its honest reason. */
export function SuggestionCard({ userId }: { userId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const discover = useCatalogDiscover(userId, null);
  const section = discover.data?.sections.find(
    (candidate) => candidate.kind === 'for_you' || candidate.kind === 'because',
  );
  const item = section?.items[0];
  if (!item) return null;
  const { book } = item;
  const open = () => router.push({ pathname: '/catalogo/[id]', params: { id: book.catalogId } });
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionTitle
        title="Pra você hoje"
        link="Descobrir"
        onLink={() => router.push('/descobrir')}
      />
      <PressCard accessibilityLabel={`${book.title}. ${item.reason ?? ''}`} onPress={open}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <BookCover
            title={book.title}
            author={book.authors[0] ?? null}
            coverUrls={book.coverUrls}
            width={72}
          />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            {item.reason ? (
              <Text variant="label" color="accentText" numberOfLines={2}>
                {item.reason}
              </Text>
            ) : null}
            <Text variant="titleSm" numberOfLines={2}>
              {book.title}
            </Text>
            <Text variant="bodySm" color="textMuted" numberOfLines={1}>
              {[book.authors[0], book.totalPages ? `${book.totalPages} pág.` : null]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <View
              style={{
                alignSelf: 'flex-start',
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.xxs,
                marginTop: theme.spacing.xs,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.primary,
              }}
            >
              <Text variant="label" color="onPrimary">
                Ver livro
              </Text>
              <Icon name="chevron-right" size={18} color="onPrimary" />
            </View>
          </View>
        </View>
      </PressCard>
    </View>
  );
}

/** Friends who share their activity and what they are reading now (with real progress). */
export function FriendsReading({ userId }: { userId: string }) {
  const theme = useTheme();
  const router = useRouter();
  const feed = useFriendsFeed(userId);
  const friends = feed.data?.readingNow ?? [];
  if (!friends.length) return null;
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionTitle title="Amigos lendo" link="Ver amigos" onLink={() => router.push('/amigos')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -theme.sizes.gutter }}
        contentContainerStyle={{ gap: theme.spacing.md, paddingHorizontal: theme.sizes.gutter }}
      >
        {friends.map((friend) => {
          const progress = friend.totalPages
            ? readingProgress(friend.currentPage, friend.totalPages)
            : null;
          return (
            <Pressable
              key={friend.userId}
              accessibilityRole="button"
              accessibilityLabel={`${friend.name} está lendo ${friend.bookTitle}${progress ? `, ${progress.percent}%` : ''}`}
              onPress={() => router.push('/amigos')}
              style={{ width: 84, alignItems: 'center', gap: theme.spacing.xxs }}
            >
              <ProgressRing
                size={68}
                stroke={4}
                progress={progress ? progress.percent / 100 : 0}
                accessibilityLabel={progress ? `${progress.percent}% do livro` : 'Lendo'}
              >
                <Avatar name={friend.name} size={54} />
              </ProgressRing>
              <Text variant="label" numberOfLines={1}>
                {friend.name.split(' ')[0]}
              </Text>
              <Text variant="caption" color="textMuted" align="center" numberOfLines={2}>
                {friend.bookTitle}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Entry to the month Replay (in progress until the month ends). */
export function ReplayBanner() {
  const theme = useTheme();
  const router = useRouter();
  const month = MONTHS[new Date().getMonth()] ?? '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir seu Replay de ${month}`}
      onPressIn={() => haptics.press()}
      onPress={() => router.push('/replay')}
    >
      {({ pressed }) => (
        <Raised
          faceColor={theme.colors.heroStart}
          borderColor={theme.colors.heroStart}
          rimColor={theme.colors.primaryRim}
          radius={theme.radii.card}
          depth={theme.sizes.cardRim}
          pressed={pressed}
          faceStyle={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.lg,
            overflow: 'hidden',
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: -40,
              top: -50,
              width: 150,
              height: 150,
              borderRadius: 75,
              backgroundColor: theme.colors.gold,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: 96,
              bottom: -34,
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: theme.colors.orange,
            }}
          />
          <View style={{ flex: 1, gap: theme.spacing.xxs }}>
            <Text variant="caption" color="onHeroMuted">
              Replay · prévia
            </Text>
            <Text variant="title" color="onPrimary">
              Seu {month} em histórias
            </Text>
            <Text variant="bodySm" color="onHeroMuted">
              Que tipo de coruja você é?
            </Text>
          </View>
          <BuboMascot state="sessionComplete" size={84} />
        </Raised>
      )}
    </Pressable>
  );
}
