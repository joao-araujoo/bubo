import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type buildWidgetSnapshot, widgetMoodNow } from '@bubo/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentProps, type ReactNode } from 'react';
import { View } from 'react-native';

import { BuboMascot, Text } from '../../design-system';
import {
  fontFamily,
  palette,
  widgetFlame,
  widgetScenes,
  type WidgetScenePalette,
} from '../../theme';

type Snapshot = ReturnType<typeof buildWidgetSnapshot>;
type Mood = ReturnType<typeof widgetMoodNow>;
type SceneId = keyof typeof widgetScenes;
type IconName = ComponentProps<typeof MaterialIcons>['name'];

export const WIDGET_SMALL = 158;
const MEDIUM_HEIGHT = 158;
const WEEK_LETTERS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

/** In-app stand-ins for the native decorations (sparkles, moon, confetti, embers, hearts). */
const DECORATIONS: Record<
  WidgetScenePalette['decoration'],
  { icon: IconName; top: number; right: number; size: number; opacity: number }[]
> = {
  sparkles: [
    { icon: 'auto-awesome', top: 8, right: 10, size: 20, opacity: 0.9 },
    { icon: 'auto-awesome', top: 46, right: 4, size: 10, opacity: 0.6 },
  ],
  stars: [
    { icon: 'nightlight-round', top: 8, right: 10, size: 22, opacity: 0.95 },
    { icon: 'star', top: 40, right: 30, size: 8, opacity: 0.7 },
    { icon: 'star', top: 14, right: 46, size: 7, opacity: 0.6 },
  ],
  confetti: [
    { icon: 'celebration', top: 8, right: 10, size: 20, opacity: 0.85 },
    { icon: 'auto-awesome', top: 44, right: 6, size: 10, opacity: 0.7 },
  ],
  embers: [
    { icon: 'auto-awesome', top: 10, right: 12, size: 14, opacity: 0.7 },
    { icon: 'circle', top: 52, right: 8, size: 6, opacity: 0.7 },
  ],
  hearts: [
    { icon: 'favorite', top: 10, right: 12, size: 18, opacity: 0.9 },
    { icon: 'favorite', top: 42, right: 4, size: 10, opacity: 0.6 },
  ],
  none: [],
};

function SceneFrame({
  scene,
  width,
  height,
  decorated = true,
  label,
  children,
}: {
  scene: SceneId;
  width: number | '100%';
  height: number;
  decorated?: boolean;
  label: string;
  children: ReactNode;
}) {
  const colors = widgetScenes[scene];
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ width, height, borderRadius: 22, overflow: 'hidden' }}
    >
      <LinearGradient
        colors={[colors.top, colors.bottom]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {decorated
        ? DECORATIONS[colors.decoration].map((item, index) => (
            <View
              key={index}
              style={{
                position: 'absolute',
                top: item.top,
                right: item.right,
                opacity: item.opacity,
              }}
            >
              <MaterialIcons name={item.icon} size={item.size} color={colors.deco} />
            </View>
          ))
        : null}
      {children}
    </View>
  );
}

function Flame({ mood, scene, size }: { mood: Mood; scene: SceneId; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <MaterialIcons
        name="local-fire-department"
        size={size}
        color={mood.lit ? widgetFlame.outer : widgetScenes[scene].number}
        style={{ opacity: mood.lit ? 1 : 0.85 }}
      />
      {mood.alert ? (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: 0,
            width: size / 2,
            height: size / 2,
            borderRadius: size / 4,
            backgroundColor: widgetFlame.alert,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ color: palette.white, fontFamily: fontFamily.extrabold, fontSize: size / 3 }}
          >
            !
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Header({
  mood,
  scene,
  number,
  size,
}: {
  mood: Mood;
  scene: SceneId;
  number: string;
  size: number;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Flame mood={mood} scene={scene} size={size} />
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1}
        style={{
          color: widgetScenes[scene].number,
          fontFamily: fontFamily.extrabold,
          fontSize: mood.title ? Math.min(size, 18) : size,
          lineHeight: size + 4,
          flexShrink: 1,
        }}
      >
        {mood.title ?? number}
      </Text>
    </View>
  );
}

function Caption({
  scene,
  children,
  lines = 2,
}: {
  scene: SceneId;
  children: string;
  lines?: number;
}) {
  return (
    <Text
      numberOfLines={lines}
      maxFontSizeMultiplier={1}
      style={{
        color: widgetScenes[scene].muted,
        fontFamily: fontFamily.bold,
        fontSize: 12,
        lineHeight: 16,
      }}
    >
      {children}
    </Text>
  );
}

/** Bubo peeking from the bottom edge (official pose, ~70% visible). */
function Peek({ mood, size, right }: { mood: Mood; size: number; right?: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: -size * 0.3,
        ...(right === undefined ? { left: 0, right: 0, alignItems: 'center' } : { right }),
      }}
    >
      <BuboMascot pose={mood.pose} size={size} />
    </View>
  );
}

function daysLabel(streak: number) {
  return streak === 1 ? '1 dia' : `${streak} dias`;
}

/** Small streak widget: flame + number, caption, Bubo peeking. */
export function StreakWidgetPreview({ snapshot, now }: { snapshot: Snapshot | null; now: Date }) {
  const mood = widgetMoodNow(snapshot, now);
  const streak = snapshot?.streakDays ?? 0;
  return (
    <SceneFrame
      scene={mood.scene}
      width={WIDGET_SMALL}
      height={WIDGET_SMALL}
      label={`Widget Sequência: ${mood.title ?? `sequência de ${daysLabel(streak)}`}. ${mood.message}`}
    >
      <Peek mood={mood} size={WIDGET_SMALL * 0.95} />
      <View style={{ paddingLeft: 12, paddingTop: 11, paddingRight: 10, gap: 2 }}>
        <Header mood={mood} scene={mood.scene} number={String(streak)} size={26} />
        <Caption scene={mood.scene}>{mood.message}</Caption>
      </View>
    </SceneFrame>
  );
}

/** Medium week widget: "N dias de sequência", caption, week checks, Bubo on the right. */
export function WeekWidgetPreview({ snapshot, now }: { snapshot: Snapshot | null; now: Date }) {
  const mood = widgetMoodNow(snapshot, now);
  const streak = snapshot?.streakDays ?? 0;
  const colors = widgetScenes[mood.scene];
  return (
    <SceneFrame
      scene={mood.scene}
      width="100%"
      height={MEDIUM_HEIGHT}
      label={`Widget Sequência da semana: ${mood.title ?? `${daysLabel(streak)} de sequência`}. ${mood.message}`}
    >
      <Peek mood={mood} size={MEDIUM_HEIGHT * 1.05} right={-10} />
      <View style={{ flex: 1, paddingLeft: 14, paddingVertical: 12, paddingRight: '34%' }}>
        <Header
          mood={mood}
          scene={mood.scene}
          number={`${daysLabel(streak)} de sequência`}
          size={18}
        />
        <Caption scene={mood.scene} lines={1}>
          {mood.message}
        </Caption>
        <View style={{ flex: 1 }} />
        <View style={{ flexDirection: 'row' }}>
          {WEEK_LETTERS.map((letter, index) => {
            const day = mood.fresh ? snapshot?.week[index] : undefined;
            const state = day?.state ?? 'future';
            return (
              <View key={index} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                <Text
                  maxFontSizeMultiplier={1}
                  style={{
                    color: state === 'today' ? colors.text : colors.muted,
                    fontFamily: fontFamily.bold,
                    fontSize: 10,
                  }}
                >
                  {letter}
                </Text>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: day?.active ? widgetFlame.outer : colors.pill,
                    borderWidth: !day?.active && state === 'today' ? 2 : 0,
                    borderColor: colors.text,
                    opacity: state === 'future' ? 0.55 : 1,
                  }}
                >
                  {day?.active ? (
                    <MaterialIcons name="check" size={16} color={palette.white} />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </SceneFrame>
  );
}

/** Medium calendar widget: month runs on the left, streak and Bubo on the right. */
export function CalendarWidgetPreview({ snapshot, now }: { snapshot: Snapshot | null; now: Date }) {
  const mood = widgetMoodNow(snapshot, now);
  const scene: SceneId = mood.fresh ? (snapshot?.activeToday ? 'mint' : 'periwinkle') : mood.scene;
  const colors = widgetScenes[scene];
  const month = snapshot?.month;
  const offset = month?.offset ?? 0;
  const days = month?.days ?? [];
  const rows = Math.max(5, Math.ceil((offset + days.length) / 7));
  const active = days.filter((day) => mood.fresh && day.active).length;
  return (
    <SceneFrame
      scene={scene}
      width="100%"
      height={MEDIUM_HEIGHT}
      decorated={false}
      label={`Widget Calendário: ${month?.label ?? 'mês'} com ${active} dias de atividade. ${mood.message}`}
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ flex: 1.4, paddingLeft: 10, paddingVertical: 10 }}>
          <View style={{ flexDirection: 'row', paddingBottom: 2 }}>
            {WEEK_LETTERS.map((letter, index) => (
              <Text
                key={index}
                maxFontSizeMultiplier={1}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  color: colors.muted,
                  fontFamily: fontFamily.extrabold,
                  fontSize: 9,
                }}
              >
                {letter}
              </Text>
            ))}
          </View>
          {Array.from({ length: rows }, (_, row) => (
            <View key={row} style={{ flex: 1, flexDirection: 'row' }}>
              {Array.from({ length: 7 }, (_, column) => {
                const day = days[row * 7 + column - offset];
                if (!day) return <View key={column} style={{ flex: 1 }} />;
                const on = mood.fresh && day.active;
                const today = mood.fresh && day.today;
                const left = day.run === 'start' || day.run === 'single' ? 9 : 0;
                const right = day.run === 'end' || day.run === 'single' ? 9 : 0;
                return (
                  <View
                    key={column}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {on ? (
                      <View
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: 1,
                          bottom: 1,
                          backgroundColor: colors.pill,
                          borderTopLeftRadius: left,
                          borderBottomLeftRadius: left,
                          borderTopRightRadius: right,
                          borderBottomRightRadius: right,
                        }}
                      />
                    ) : null}
                    {today ? (
                      <View
                        style={{
                          position: 'absolute',
                          width: 17,
                          height: 17,
                          borderRadius: 9,
                          backgroundColor: on ? colors.number : palette.transparent,
                          borderWidth: on ? 0 : 1.5,
                          borderColor: colors.number,
                        }}
                      />
                    ) : null}
                    <Text
                      maxFontSizeMultiplier={1}
                      style={{
                        color:
                          on && today
                            ? palette.white
                            : on
                              ? colors.pillText
                              : day.future
                                ? colors.muted
                                : colors.text,
                        fontFamily: fontFamily.extrabold,
                        fontSize: 10,
                      }}
                    >
                      {day.day}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            paddingTop: 12,
            paddingRight: 6,
            overflow: 'hidden',
          }}
        >
          <Peek mood={mood} size={MEDIUM_HEIGHT * 0.85} />
          <Header mood={mood} scene={scene} number={String(snapshot?.streakDays ?? 0)} size={28} />
          <Text
            numberOfLines={2}
            maxFontSizeMultiplier={1}
            style={{
              color: colors.muted,
              fontFamily: fontFamily.bold,
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            {mood.message}
          </Text>
        </View>
      </View>
    </SceneFrame>
  );
}

/** Medium reading widget: streak header, white book card, Bubo peeking on the right. */
export function ReadingWidgetPreview({
  snapshot,
  now,
  cover,
}: {
  snapshot: Snapshot | null;
  now: Date;
  cover?: ReactNode;
}) {
  const mood = widgetMoodNow(snapshot, now);
  const book = mood.fresh ? snapshot?.book : null;
  return (
    <SceneFrame
      scene={mood.scene}
      width="100%"
      height={MEDIUM_HEIGHT}
      label={`Widget Continuar leitura: ${book ? `${book.title}, página ${book.page}` : 'sua próxima leitura'}. ${mood.message}`}
    >
      <Peek mood={mood} size={MEDIUM_HEIGHT * 0.92} right={-8} />
      <View style={{ flex: 1, padding: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: '27%' }}>
          <Header
            mood={mood}
            scene={mood.scene}
            number={String(snapshot?.streakDays ?? 0)}
            size={18}
          />
          <View style={{ flex: 1 }}>
            <Caption scene={mood.scene} lines={1}>
              {mood.message}
            </Caption>
          </View>
        </View>
        <View
          style={{
            flex: 1,
            marginRight: '27%',
            borderRadius: 16,
            backgroundColor: palette.white,
            padding: 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {book && cover ? cover : null}
          <View style={{ flex: 1, gap: 3 }}>
            <Text
              numberOfLines={2}
              maxFontSizeMultiplier={1}
              style={{ color: palette.ink, fontFamily: fontFamily.extrabold, fontSize: 14 }}
            >
              {book?.title ?? 'Sua próxima leitura'}
            </Text>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1}
              style={{ color: palette.inkMuted, fontFamily: fontFamily.regular, fontSize: 11 }}
            >
              {book
                ? `Página ${book.page}${book.totalPages ? ` de ${book.totalPages}` : ''}`
                : 'Adicione um livro à sua estante'}
            </Text>
            {book?.progress !== null && book?.progress !== undefined ? (
              <View style={{ height: 7, borderRadius: 4, backgroundColor: palette.purpleSoft }}>
                <View
                  style={{
                    width: `${book.progress}%`,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: palette.purple,
                  }}
                />
              </View>
            ) : null}
            <Text
              maxFontSizeMultiplier={1}
              style={{ color: palette.purple, fontFamily: fontFamily.bold, fontSize: 11 }}
            >
              {book ? 'Continuar leitura' : 'Abrir Estante'}
            </Text>
          </View>
        </View>
      </View>
    </SceneFrame>
  );
}

/** Today's real mood timeline: how the widgets will change through the day. */
export function MoodTimeline({ snapshot }: { snapshot: Snapshot }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {snapshot.moods
        .filter((mood) => mood.fromHour > 0)
        .map((mood) => {
          const colors = widgetScenes[mood.scene];
          return (
            <View
              key={mood.fromHour}
              accessible
              accessibilityLabel={`A partir das ${mood.fromHour} horas: ${mood.message}`}
              style={{ width: 96, height: 112, borderRadius: 18, overflow: 'hidden' }}
            >
              <LinearGradient
                colors={[colors.top, colors.bottom]}
                style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: -22,
                  left: 0,
                  right: 0,
                  alignItems: 'center',
                }}
              >
                <BuboMascot pose={mood.pose} size={78} />
              </View>
              <View style={{ padding: 8, gap: 1 }}>
                <Text
                  maxFontSizeMultiplier={1}
                  style={{ color: colors.number, fontFamily: fontFamily.extrabold, fontSize: 14 }}
                >
                  {`${mood.fromHour}h`}
                </Text>
                <Text
                  numberOfLines={2}
                  maxFontSizeMultiplier={1}
                  style={{
                    color: colors.muted,
                    fontFamily: fontFamily.bold,
                    fontSize: 10,
                    lineHeight: 13,
                  }}
                >
                  {mood.message}
                </Text>
              </View>
            </View>
          );
        })}
    </View>
  );
}
