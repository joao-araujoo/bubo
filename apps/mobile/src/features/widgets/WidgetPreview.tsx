import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { type WidgetSnapshot } from '@bubo/contracts';
import { WEEKDAY_LETTERS_PT, widgetMoodNow } from '@bubo/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { type ComponentProps, type ReactNode } from 'react';
import { View } from 'react-native';

import { type MascotPose } from '../../assets/registry';
import { BuboMascot, Text } from '../../design-system';
import { fontFamily, widgetPalette as c } from '../../theme';

type Mood = ReturnType<typeof widgetMoodNow>;
type IconName = ComponentProps<typeof MaterialIcons>['name'];

export const WIDGET_SMALL = 158;
const MEDIUM_HEIGHT = 162;

/**
 * In-app previews of the native widgets (ADR-029), drawn with the same tokens, poses and copy.
 * Native widgets draw the generated vector icons; previews approximate them with Material icons.
 */
const POSES: Record<WidgetSnapshot['pose'], MascotPose> = {
  welcome: 'welcome',
  happy: 'happy',
  reading: 'reading',
  review: 'review',
  celebrating: 'celebrating',
  achievement: 'achievement',
  cheering: 'cheering',
  worried: 'worried',
  surprised: 'surprised',
  sleeping: 'sleeping',
  doubt: 'doubt',
  curious: 'curious',
  confident: 'confident',
  thinking: 'thinking',
  'deep-reading': 'deepReading',
};

function Frame({
  width,
  height,
  label,
  league = false,
  children,
}: {
  width: number | '100%';
  height: number;
  label: string;
  league?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ width, height, borderRadius: 24, overflow: 'hidden' }}
    >
      <LinearGradient
        colors={league ? [c.leagueTop, c.leagueBottom] : [c.surface, c.surfaceEnd]}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      {children}
    </View>
  );
}

/** Bubo entering from the bottom-right corner; the frame clips it, the pose is never edited. */
function Corner({
  pose,
  size,
  right,
  bottom,
}: {
  pose: WidgetSnapshot['pose'];
  size: number;
  right: number;
  bottom: number;
}) {
  return (
    <View style={{ position: 'absolute', right, bottom }}>
      <BuboMascot pose={POSES[pose]} size={size} />
    </View>
  );
}

function Label({
  children,
  size,
  color,
  weight = 'semibold',
  lines = 1,
  align,
}: {
  children: string;
  size: number;
  color: string;
  weight?: keyof typeof fontFamily;
  lines?: number;
  align?: 'center';
}) {
  return (
    <Text
      numberOfLines={lines}
      maxFontSizeMultiplier={1}
      style={{
        color,
        fontFamily: fontFamily[weight],
        fontSize: size,
        lineHeight: Math.round(size * 1.25),
        textAlign: align,
      }}
    >
      {children}
    </Text>
  );
}

function Flame({ mood, size }: { mood: Mood; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <MaterialIcons
        name={mood.lit ? 'local-fire-department' : 'whatshot'}
        size={size}
        color={c.flame}
        style={{ opacity: mood.lit ? 1 : 0.45 }}
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
            borderWidth: 1.5,
            borderColor: c.white,
            backgroundColor: c.alert,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Label size={size / 3} color={c.white} weight="extrabold">
            !
          </Label>
        </View>
      ) : null}
    </View>
  );
}

function FreezeChip({ count }: { count: number }) {
  return (
    <View
      accessible
      accessibilityLabel={count === 1 ? '1 proteção pronta' : `${count} proteções prontas`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        height: 22,
        borderRadius: 11,
        backgroundColor: c.freezeSoft,
      }}
    >
      <MaterialIcons name="ac-unit" size={13} color={c.freeze} />
      <Label size={12} color={c.freezeText} weight="bold">
        {String(count)}
      </Label>
    </View>
  );
}

function streakTitle(snapshot: WidgetSnapshot | null, mood: Mood) {
  if (!mood.fresh) return mood.title ?? 'Abra o Bubo';
  const streak = snapshot?.streakDays ?? 0;
  if (streak === 1) return '1 dia seguido';
  if (streak > 1) return `${streak} dias seguidos`;
  return 'Comece sua sequência';
}

const captionColor = (mood: Mood) => (mood.tone === 'risk' ? c.flameText : c.muted);

/** Compact streak (2×2): flame + number, short label and Bubo in the corner. */
export function StreakWidgetPreview({
  snapshot,
  now,
}: {
  snapshot: WidgetSnapshot | null;
  now: Date;
}) {
  const mood = widgetMoodNow(snapshot, now);
  const streak = snapshot?.streakDays ?? 0;
  const label =
    !mood.fresh || mood.tone === 'risk'
      ? mood.message
      : streak === 1
        ? 'dia seguido'
        : streak > 1
          ? 'dias seguidos'
          : 'Que tal começar hoje?';
  return (
    <Frame
      width={WIDGET_SMALL}
      height={WIDGET_SMALL}
      label={`Widget Sequência: ${streakTitle(snapshot, mood)}. ${mood.message}`}
    >
      <Corner
        pose={mood.pose}
        size={WIDGET_SMALL * 0.86}
        right={-WIDGET_SMALL * 0.1}
        bottom={-WIDGET_SMALL * 0.3}
      />
      <View style={{ padding: 14, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Flame mood={mood} size={28} />
          <Label
            size={mood.fresh ? 32 : 18}
            weight="extrabold"
            color={mood.fresh && streak > 0 ? c.flameText : c.ink}
          >
            {mood.fresh ? String(streak) : (mood.title ?? 'Abra o Bubo')}
          </Label>
        </View>
        <View style={{ width: '64%' }}>
          <Label size={12.5} color={captionColor(mood)} lines={2}>
            {label}
          </Label>
        </View>
      </View>
    </Frame>
  );
}

function DayCircle({ state, active, size }: { state: string; active: boolean; size: number }) {
  const done = state === 'done' || (state === 'today' && active);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: done ? c.flame : state === 'frozen' ? c.freezeSoft : c.empty,
        borderWidth: state === 'today' && !active ? 2.5 : 0,
        borderColor: c.flame,
        opacity: state === 'future' ? 0.6 : 1,
      }}
    >
      {done ? <MaterialIcons name="check" size={size * 0.68} color={c.white} /> : null}
      {state === 'frozen' ? (
        <MaterialIcons name="ac-unit" size={size * 0.6} color={c.freeze} />
      ) : null}
    </View>
  );
}

/** Day Streak (4×2): "12 dias seguidos", a caption and the week; Bubo on the right. */
export function WeekWidgetPreview({
  snapshot,
  now,
}: {
  snapshot: WidgetSnapshot | null;
  now: Date;
}) {
  const mood = widgetMoodNow(snapshot, now);
  const streak = snapshot?.streakDays ?? 0;
  const week = mood.fresh ? snapshot?.week : undefined;
  const done = week?.filter((day) => day.active).length ?? 0;
  return (
    <Frame
      width="100%"
      height={MEDIUM_HEIGHT}
      label={`Widget Sequência da semana: ${streakTitle(snapshot, mood)}. ${mood.message}${week ? `. ${done} dias com atividade nesta semana` : ''}`}
    >
      <Corner
        pose={mood.pose}
        size={MEDIUM_HEIGHT * 0.86}
        right={-14}
        bottom={-MEDIUM_HEIGHT * 0.17}
      />
      <View style={{ flex: 1, padding: 16, paddingRight: MEDIUM_HEIGHT * 0.72 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <Flame mood={mood} size={27} />
          <View style={{ flexShrink: 1 }}>
            <Label
              size={22}
              weight="extrabold"
              color={mood.fresh && streak > 0 ? c.flameText : c.ink}
            >
              {streakTitle(snapshot, mood)}
            </Label>
          </View>
        </View>
        <View style={{ paddingLeft: 34 }}>
          <Label size={13.5} color={captionColor(mood)} lines={2}>
            {mood.message}
          </Label>
        </View>
        <View style={{ flex: 1 }} />
        {week ? (
          <View style={{ flexDirection: 'row' }}>
            {week.map((day, index) => (
              <View key={day.date} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                <Label size={11} weight="bold" color={day.state === 'today' ? c.ink : c.faint}>
                  {WEEKDAY_LETTERS_PT[index] ?? ''}
                </Label>
                <DayCircle state={day.state} active={day.active} size={26} />
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {mood.fresh && snapshot && snapshot.freeze.available > 0 ? (
        <View style={{ position: 'absolute', top: 14, right: 14 }}>
          <FreezeChip count={snapshot.freeze.available} />
        </View>
      ) : null}
    </Frame>
  );
}

/** Calendar (4×2): the month on the left; the streak and Bubo on the right. */
export function CalendarWidgetPreview({
  snapshot,
  now,
}: {
  snapshot: WidgetSnapshot | null;
  now: Date;
}) {
  const mood = widgetMoodNow(snapshot, now);
  const month = snapshot?.month;
  const offset = month?.offset ?? 0;
  const days = month?.days ?? [];
  const rows = Math.max(5, Math.ceil((offset + days.length) / 7));
  const streak = snapshot?.streakDays ?? 0;
  return (
    <Frame
      width="100%"
      height={MEDIUM_HEIGHT}
      label={`Widget Calendário de leitura: ${month?.title ?? ''}. ${mood.fresh ? `${streak} dias seguidos` : (mood.title ?? '')}`}
    >
      <Corner
        pose={mood.pose}
        size={MEDIUM_HEIGHT * 0.62}
        right={-10}
        bottom={-MEDIUM_HEIGHT * 0.17}
      />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ width: '60%', paddingLeft: 12, paddingTop: 12, paddingBottom: 8 }}>
          <Label size={15} weight="extrabold" color={c.ink}>
            {month?.title ?? ''}
          </Label>
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            {WEEKDAY_LETTERS_PT.map((letter, index) => (
              <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                <Label size={9} weight="bold" color={c.faint}>
                  {letter}
                </Label>
              </View>
            ))}
          </View>
          {Array.from({ length: rows }, (_, row) => (
            <View key={row} style={{ flex: 1, flexDirection: 'row' }}>
              {Array.from({ length: 7 }, (_, column) => {
                const day = days[row * 7 + column - offset];
                if (!day) return <View key={column} style={{ flex: 1 }} />;
                const active = mood.fresh && day.active;
                const frozen = mood.fresh && day.frozen;
                const start = day.run === 'start' || day.run === 'single';
                const end = day.run === 'end' || day.run === 'single';
                return (
                  <View
                    key={column}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  >
                    {active ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 1,
                          bottom: 1,
                          left: start ? 2 : 0,
                          right: end ? 2 : 0,
                          backgroundColor: c.streakSoft,
                          borderTopLeftRadius: start ? 99 : 0,
                          borderBottomLeftRadius: start ? 99 : 0,
                          borderTopRightRadius: end ? 99 : 0,
                          borderBottomRightRadius: end ? 99 : 0,
                        }}
                      />
                    ) : null}
                    {frozen ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 1,
                          bottom: 1,
                          left: 2,
                          right: 2,
                          borderRadius: 5,
                          backgroundColor: c.freezeSoft,
                        }}
                      />
                    ) : null}
                    {day.today && mood.fresh ? (
                      <View
                        style={{
                          position: 'absolute',
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: active ? c.flame : undefined,
                          borderWidth: active ? 0 : 1.5,
                          borderColor: c.flame,
                        }}
                      />
                    ) : null}
                    <Label
                      size={9.5}
                      weight={active || frozen || day.today ? 'bold' : 'medium'}
                      color={
                        day.today && active
                          ? c.white
                          : active
                            ? c.streakText
                            : frozen
                              ? c.freezeText
                              : day.future
                                ? c.faint
                                : c.ink
                      }
                    >
                      {String(day.day)}
                    </Label>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <View style={{ width: 1, marginVertical: 14, backgroundColor: c.divider }} />
        <View style={{ flex: 1, alignItems: 'center', paddingTop: 12, gap: 1 }}>
          {mood.fresh ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Flame mood={mood} size={26} />
                <Label size={34} weight="extrabold" color={c.flameText}>
                  {String(streak)}
                </Label>
              </View>
              <Label size={12.5} color={c.ink}>
                {streak === 1 ? 'dia seguido' : 'dias seguidos'}
              </Label>
              {snapshot && snapshot.freeze.available > 0 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <MaterialIcons name="ac-unit" size={11} color={c.freeze} />
                  <Label size={10.5} weight="bold" color={c.freezeText}>
                    {snapshot.freeze.available === 1
                      ? '1 proteção'
                      : `${snapshot.freeze.available} proteções`}
                  </Label>
                </View>
              ) : null}
            </>
          ) : (
            <View style={{ paddingHorizontal: 8, gap: 2 }}>
              <Label size={15} weight="extrabold" color={c.ink} align="center">
                {mood.title ?? 'Abra o Bubo'}
              </Label>
              <Label size={11} color={c.muted} lines={2} align="center">
                {mood.message}
              </Label>
            </View>
          )}
        </View>
      </View>
    </Frame>
  );
}

/** Continue reading (4×2): no inner card; cover, title, author, page, progress, quiet action. */
export function ReadingWidgetPreview({
  snapshot,
  now,
  cover,
}: {
  snapshot: WidgetSnapshot | null;
  now: Date;
  cover?: ReactNode;
}) {
  const mood = widgetMoodNow(snapshot, now);
  const book = mood.fresh ? snapshot?.book : null;
  const streak = snapshot?.streakDays ?? 0;
  const pose: WidgetSnapshot['pose'] = !mood.fresh
    ? mood.pose
    : !book
      ? 'deep-reading'
      : mood.lit
        ? 'celebrating'
        : 'reading';
  return (
    <Frame
      width="100%"
      height={MEDIUM_HEIGHT}
      label={
        book
          ? `Widget Continuar leitura: ${book.title}${book.author ? `, de ${book.author}` : ''}, página ${book.page}${book.totalPages ? ` de ${book.totalPages}` : ''}`
          : 'Widget Continuar leitura: nenhuma leitura ativa'
      }
    >
      <Corner
        pose={pose}
        size={MEDIUM_HEIGHT * 0.8}
        right={-MEDIUM_HEIGHT * 0.16}
        bottom={-MEDIUM_HEIGHT * 0.21}
      />
      <View style={{ flex: 1, padding: 15, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {mood.fresh ? (
            <>
              <Flame mood={mood} size={16} />
              <Label size={13} weight="extrabold" color={streak > 0 ? c.flameText : c.muted}>
                {String(streak)}
              </Label>
              <View style={{ width: 6 }} />
            </>
          ) : null}
          <View style={{ flexShrink: 1 }}>
            <Label size={12} weight="medium" color={captionColor(mood)}>
              {mood.fresh ? mood.message : ''}
            </Label>
          </View>
        </View>
        {book ? (
          <View style={{ flexDirection: 'row', gap: 12, paddingRight: MEDIUM_HEIGHT * 0.45 }}>
            {cover ?? (
              <View style={{ width: 62, height: 90, borderRadius: 6, backgroundColor: c.empty }} />
            )}
            <View style={{ flex: 1, gap: 1 }}>
              <Label size={15.5} weight="extrabold" color={c.ink} lines={2}>
                {book.title}
              </Label>
              {book.author ? (
                <Label size={12} weight="medium" color={c.muted}>
                  {book.author}
                </Label>
              ) : null}
              <View style={{ height: 5 }} />
              <Label size={11.5} color={c.ink}>
                {book.totalPages
                  ? `Página ${book.page} de ${book.totalPages}`
                  : `Página ${book.page}`}
              </Label>
              {book.progress !== null ? (
                <View
                  style={{
                    height: 6,
                    marginTop: 4,
                    maxWidth: 150,
                    borderRadius: 3,
                    backgroundColor: c.empty,
                  }}
                >
                  <View
                    style={{
                      width: `${Math.max(4, book.progress)}%`,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: c.purple,
                    }}
                  />
                </View>
              ) : null}
              <Action label="Continuar leitura" />
            </View>
          </View>
        ) : (
          <View style={{ gap: 3, paddingRight: MEDIUM_HEIGHT * 0.55 }}>
            <Label size={15.5} weight="extrabold" color={c.ink}>
              {mood.fresh ? 'Nenhuma leitura ativa' : (mood.title ?? 'Abra o Bubo')}
            </Label>
            <Label size={12} weight="medium" color={c.muted} lines={2}>
              {mood.fresh ? 'Escolha um livro na Estante para continuar daqui.' : mood.message}
            </Label>
            <Action label={mood.fresh ? 'Abrir Estante' : 'Abrir o Bubo'} />
          </View>
        )}
      </View>
    </Frame>
  );
}

function Action({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
      <Label size={12.5} weight="bold" color={c.purple}>
        {label}
      </Label>
      <MaterialIcons name="chevron-right" size={18} color={c.purple} />
    </View>
  );
}

function Line({ icon, color, label }: { icon: IconName; color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <MaterialIcons name={icon} size={17} color={color} />
      <View style={{ flexShrink: 1 }}>
        <Label size={13} weight="bold" color={color}>
          {label}
        </Label>
      </View>
    </View>
  );
}

/** League (4×2): rank, today's movement, the week and a small podium around the reader. */
export function LeagueWidgetPreview({
  snapshot,
  now,
}: {
  snapshot: WidgetSnapshot | null;
  now: Date;
}) {
  const mood = widgetMoodNow(snapshot, now);
  const league = mood.fresh ? snapshot?.league : null;
  const friends = league ? league.participants > 1 : false;
  const days = league
    ? league.daysLeft === 1
      ? 'Último dia'
      : `${league.daysLeft} dias restantes`
    : '';
  const previous = league?.previousRank ?? null;
  const moved = league && previous !== null ? previous - league.rank : 0;
  const title = !mood.fresh
    ? (mood.title ?? 'Abra o Bubo')
    : !league
      ? 'Liga semanal'
      : friends
        ? `#${league.rank} entre amigos`
        : 'Sua liga semanal';
  const steps = [0.17, 0.25, 0.33];
  return (
    <Frame width="100%" height={MEDIUM_HEIGHT} league label={`Widget Liga semanal: ${title}`}>
      {!friends ? (
        <Corner
          pose={!mood.fresh ? mood.pose : league ? 'cheering' : 'doubt'}
          size={MEDIUM_HEIGHT * 0.86}
          right={-14}
          bottom={-MEDIUM_HEIGHT * 0.26}
        />
      ) : null}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View style={{ width: friends ? '56%' : '66%', padding: 16, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.purple,
              }}
            >
              <MaterialIcons name="diamond" size={19} color={c.gem} />
            </View>
            <View style={{ flexShrink: 1 }}>
              <Label size={19} weight="extrabold" color={c.purple}>
                {title}
              </Label>
            </View>
          </View>
          {league ? (
            <View style={{ gap: 6, marginTop: 4 }}>
              {friends ? (
                <Line
                  icon={moved > 0 ? 'arrow-drop-up' : moved < 0 ? 'arrow-drop-down' : 'drag-handle'}
                  color={moved > 0 ? c.up : c.muted}
                  label={
                    previous === null
                      ? 'Semana começando'
                      : moved > 0
                        ? `+${moved} ${moved === 1 ? 'posição' : 'posições'} hoje`
                        : moved < 0
                          ? `Caiu ${-moved} ${moved === -1 ? 'posição' : 'posições'}`
                          : 'Mesma posição'
                  }
                />
              ) : null}
              <Line
                icon="emoji-events"
                color={c.purple}
                label={friends ? 'Liga semanal' : `${league.weeklyXp} XP nesta semana`}
              />
              <Line icon="schedule" color={c.time} label={days} />
              {!friends ? (
                <Label size={12} weight="medium" color={c.muted}>
                  Adicione amigos nos clubes
                </Label>
              ) : null}
            </View>
          ) : (
            <Label size={13} color={c.muted} lines={2}>
              {mood.fresh ? 'Abra o Bubo para atualizar' : mood.message}
            </Label>
          )}
        </View>
        {league && friends ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', paddingRight: 6 }}>
            {[
              ...Array.from({ length: 3 - league.podium.length }, () => null),
              ...league.podium,
            ].map((spot, index) => (
              <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                {spot ? (
                  <>
                    {spot.me ? (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
                        <Label size={17} weight="extrabold" color={c.purple}>
                          {String(spot.xp)}
                        </Label>
                        <Label size={9} weight="extrabold" color={c.purple}>
                          XP
                        </Label>
                      </View>
                    ) : (
                      <Label size={13} weight="bold" color={c.muted}>
                        {String(spot.xp)}
                      </Label>
                    )}
                    <View
                      style={{
                        width: spot.me ? 44 : 40,
                        height: spot.me ? 44 : 40,
                        borderRadius: 22,
                        marginVertical: 4,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: c.avatar,
                        borderWidth: spot.me ? 2.5 : 1.2,
                        borderColor: spot.me ? c.purple : c.podium,
                      }}
                    >
                      <Label size={14} weight="extrabold" color={c.purpleInk}>
                        {spot.initials}
                      </Label>
                    </View>
                  </>
                ) : null}
                <View
                  style={{
                    alignSelf: 'stretch',
                    marginHorizontal: 2,
                    height: MEDIUM_HEIGHT * (steps[index] ?? 0.2),
                    borderTopLeftRadius: 9,
                    borderTopRightRadius: 9,
                    backgroundColor: c.podium,
                    borderTopWidth: 5,
                    borderTopColor: c.podiumTop,
                  }}
                />
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </Frame>
  );
}

/** Today's real mood timeline: how the widgets will change through the day. */
export function MoodTimeline({ snapshot }: { snapshot: WidgetSnapshot }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {snapshot.moods
        .filter((mood) => mood.fromHour > 0)
        .map((mood) => (
          <View
            key={mood.fromHour}
            accessible
            accessibilityLabel={`A partir das ${mood.fromHour} horas: ${mood.message}`}
            style={{ width: 96, height: 112, borderRadius: 18, overflow: 'hidden' }}
          >
            <LinearGradient
              colors={[c.surface, c.surfaceEnd]}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
            <View style={{ position: 'absolute', bottom: -20, right: -12 }}>
              <BuboMascot pose={POSES[mood.pose]} size={76} />
            </View>
            <View style={{ padding: 8, gap: 1 }}>
              <Label
                size={14}
                weight="extrabold"
                color={mood.tone === 'risk' ? c.flameText : c.ink}
              >
                {`${mood.fromHour}h`}
              </Label>
              <Label
                size={10}
                weight="semibold"
                color={captionColor({ ...mood, fresh: true, title: null })}
                lines={2}
              >
                {mood.message}
              </Label>
            </View>
          </View>
        ))}
    </View>
  );
}
