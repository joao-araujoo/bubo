import { stableBucket } from './catalog';
import { addDays, startOfWeek } from './streak';
import { toLocalIsoDate, WEEKDAY_LABELS_PT } from './week';

export const MONTH_LABELS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

/** One-letter weekday initials, Monday first (as on the reference widgets). */
export const WEEKDAY_LETTERS_PT = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'] as const;

/** Number of typographic cover palettes (`coverPalettes` in the mobile theme). */
export const COVER_PALETTE_COUNT = 6;

type Pose =
  | 'welcome'
  | 'happy'
  | 'reading'
  | 'review'
  | 'celebrating'
  | 'achievement'
  | 'cheering'
  | 'worried'
  | 'surprised'
  | 'sleeping'
  | 'doubt'
  | 'curious'
  | 'confident'
  | 'thinking'
  | 'deep-reading';
/**
 * How the caption reads: `risk` is the only warm/urgent tone; the rest stay calm. Backgrounds
 * are always the same clean surface (ADR-029); the pose carries the emotion.
 */
type Tone = 'calm' | 'done' | 'risk' | 'night' | 'stale' | 'welcome';
type Mood = { fromHour: number; pose: Pose; message: string; lit: boolean; tone: Tone };
/** `alert` adds the red "!" badge to the flame while the streak is at risk. */
export type WidgetMoodModel = Mood & { alert: boolean };

/** Hours (local) where the widget mood may change; natives schedule timeline entries on them. */
export const WIDGET_MOOD_HOURS = [0, 6, 18, 21, 22] as const;

/** From this many days the streak is "high" and Bubo shows confidence. */
export const HIGH_STREAK_DAYS = 30;

/**
 * Today's moods, Duolingo-style: calm in the morning, a nudge in the evening, "last chance" late
 * at night while the streak is at risk, celebration once there is real activity today.
 * With a streak protection ready, the evening stays calm: a missed day would be covered.
 * Pure: every mood comes from the reader's real numbers.
 */
export function buildWidgetMoods(input: {
  valid: boolean;
  streakDays: number;
  activeToday: boolean;
  readToday: boolean;
  goalMet: boolean;
  availableReviews: number;
  hasBook: boolean;
  freezesAvailable?: number;
  frozenYesterday?: boolean;
}): WidgetMoodModel[] {
  return moods(input).map((mood) => ({ ...mood, alert: mood.tone === 'risk' }));
}

function moods(input: Parameters<typeof buildWidgetMoods>[0]): Mood[] {
  if (!input.valid) {
    return [{ fromHour: 0, pose: 'doubt', message: 'Abra o Bubo', lit: false, tone: 'stale' }];
  }
  const lit = input.activeToday;
  const protectedToday = (input.freezesAvailable ?? 0) > 0;
  const sleeping: Mood = {
    fromHour: 0,
    pose: 'sleeping',
    message: lit
      ? 'Missão cumprida. Bons sonhos!'
      : protectedToday && input.streakDays > 0
        ? 'Zzz… a proteção cobre hoje'
        : 'Zzz… hora de descansar',
    lit,
    tone: 'night',
  };
  if (lit) {
    const done: Mood = input.goalMet
      ? { fromHour: 6, pose: 'achievement', message: 'Meta da semana batida!', lit, tone: 'done' }
      : input.readToday
        ? {
            fromHour: 6,
            pose: 'celebrating',
            message:
              input.streakDays >= HIGH_STREAK_DAYS ? 'Que sequência linda!' : 'Leitura feita hoje!',
            lit,
            tone: 'done',
          }
        : { fromHour: 6, pose: 'cheering', message: 'Revisão feita hoje!', lit, tone: 'done' };
    return [sleeping, done, { ...sleeping, fromHour: 22 }];
  }
  const reviews = input.availableReviews;
  const day: Mood =
    input.frozenYesterday && input.streakDays > 0
      ? {
          fromHour: 6,
          pose: 'happy',
          message: 'A proteção salvou sua sequência',
          lit,
          tone: 'calm',
        }
      : reviews > 0
        ? {
            fromHour: 6,
            pose: 'review',
            message: reviews === 1 ? '1 revisão te espera' : `${reviews} revisões te esperam`,
            lit,
            tone: 'calm',
          }
        : input.hasBook
          ? { fromHour: 6, pose: 'reading', message: 'Bora ler um pouquinho?', lit, tone: 'calm' }
          : input.streakDays >= HIGH_STREAK_DAYS
            ? { fromHour: 6, pose: 'confident', message: 'Bora manter o ritmo?', lit, tone: 'calm' }
            : input.streakDays > 0
              ? { fromHour: 6, pose: 'happy', message: 'Bora manter o ritmo?', lit, tone: 'calm' }
              : {
                  fromHour: 6,
                  pose: 'curious',
                  message: 'Que tal começar hoje?',
                  lit,
                  tone: 'welcome',
                };
  if (input.streakDays === 0) return [sleeping, day, { ...sleeping, fromHour: 22 }];
  if (protectedToday) {
    return [
      sleeping,
      day,
      {
        fromHour: 18,
        pose: 'thinking',
        message: 'Leia hoje: a proteção fica guardada',
        lit,
        tone: 'calm',
      },
      { ...sleeping, fromHour: 22 },
    ];
  }
  return [
    sleeping,
    day,
    { fromHour: 18, pose: 'worried', message: 'Salve sua sequência!', lit, tone: 'risk' },
    { fromHour: 21, pose: 'surprised', message: 'Está ficando tarde!', lit, tone: 'risk' },
    { fromHour: 22, pose: 'worried', message: 'Última chance!', lit, tone: 'risk' },
  ];
}

/** The mood in effect at `hour` (moods are sorted by `fromHour`, the first one starts at 0). */
export function moodAt<T extends { fromHour: number }>(moods: readonly T[], hour: number): T {
  return moods.reduce((current, mood) => (mood.fromHour <= hour ? mood : current), moods[0]!);
}

/**
 * Month calendar, Monday first. Consecutive active days in the same row form a run; days covered
 * by a streak protection stand on their own (`frozen`) and never join a run.
 */
export function buildWidgetMonth(
  today: string,
  activeDates: ReadonlySet<string>,
  frozenDates: ReadonlySet<string> = new Set(),
) {
  const [year, month] = today.split('-').map(Number) as [number, number];
  const first = `${today.slice(0, 8)}01`;
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const active = (day: number) =>
    day >= 1 && day <= length && activeDates.has(addDays(first, day - 1));
  const days = Array.from({ length }, (_, index) => {
    const day = index + 1;
    const date = addDays(first, index);
    const column = (offset + index) % 7;
    const joinsPrevious = column > 0 && active(day - 1);
    const joinsNext = column < 6 && active(day + 1);
    const isActive = active(day);
    return {
      day,
      active: isActive,
      frozen: !isActive && frozenDates.has(date),
      today: date === today,
      future: date > today,
      run: !isActive
        ? ('none' as const)
        : joinsPrevious && joinsNext
          ? ('middle' as const)
          : joinsPrevious
            ? ('end' as const)
            : joinsNext
              ? ('start' as const)
              : ('single' as const),
    };
  });
  const label = MONTH_LABELS_PT[month - 1] ?? '';
  return { label, year, title: `${label} ${year}`, offset, days };
}

/** Up to two initials ("Ana Leitora" → "AL"), like the app's Avatar. */
export function nameInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase() || '?';
}

/**
 * The three podium spots around the reader (left → right: lower rank to higher rank), like the
 * reference: the reader in the middle, the next one below on the left and the one above on the
 * right. At the top or bottom the window shifts so the reader is still shown.
 */
export function leaguePodium<T extends { rank: number }>(entries: readonly T[], myRank: number) {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const count = sorted.length;
  const best = Math.max(1, Math.min(myRank - 1, count - 2));
  return sorted.filter((entry) => entry.rank >= best && entry.rank < best + 3).reverse();
}

type LeagueInput = {
  today: string;
  daysLeft: number;
  me: { rank: number; previousRank: number | null; weeklyXp: number };
  entries: readonly { rank: number; name: string; weeklyXp: number; me: boolean }[];
};

/** Only published, owner-scoped data enters a system widget. No notes, answers or auth tokens. */
export function buildWidgetSnapshot(input: {
  now: Date;
  updatedAt: number;
  hideBookOnLockScreen: boolean;
  weeklyGoal: number;
  entries: readonly {
    id: string;
    status: string;
    currentPage: number;
    book: {
      title: string;
      author?: string | null;
      totalPages: number | null;
      coverUrls: readonly string[];
    };
  }[];
  stats: {
    today: string;
    streakDays: number;
    weekReadingDates: readonly string[];
    weekActiveDates: readonly string[];
    monthActiveDates: readonly string[];
    readToday: boolean;
    reviewedToday: boolean;
    streakFreeze?: { available: number; max: number; frozenDates: readonly string[] };
  };
  due: { today: string; cards: readonly unknown[]; dueCount: number; nextDueDate: string | null };
  /** The weekly league, when it loaded; omitted or stale → "ranking indisponível". */
  league?: LeagueInput | null;
}) {
  const today = toLocalIsoDate(input.now);
  const current = input.entries.find((entry) => entry.status === 'reading');
  const weekStart = startOfWeek(today);
  const dailyDataValid = input.stats.today === today && input.due.today === today;
  // Activity claims for today are only honest while the stats belong to today.
  const activeToday = dailyDataValid && (input.stats.readToday || input.stats.reviewedToday);
  const readToday = dailyDataValid && input.stats.readToday;
  const freeze = input.stats.streakFreeze ?? { available: 0, max: 2, frozenDates: [] };
  const frozen = new Set(dailyDataValid ? freeze.frozenDates : []);
  const week = WEEKDAY_LABELS_PT.map((label, i) => {
    const date = addDays(weekStart, i);
    const past = date <= today;
    const active = past && input.stats.weekActiveDates.includes(date);
    const isFrozen = !active && date < today && frozen.has(date);
    return {
      label,
      letter: WEEKDAY_LETTERS_PT[i] ?? '',
      date,
      active,
      read: past && input.stats.weekReadingDates.includes(date),
      frozen: isFrozen,
      state:
        date === today
          ? ('today' as const)
          : date > today
            ? ('future' as const)
            : active
              ? ('done' as const)
              : isFrozen
                ? ('frozen' as const)
                : ('missed' as const),
    };
  });
  const activeDays = week.filter((day) => day.read).length;
  const weeklyGoal = Math.min(7, Math.max(1, Math.floor(input.weeklyGoal)));
  const availableReviews = dailyDataValid ? input.due.cards.length : 0;
  const freezesAvailable = dailyDataValid ? freeze.available : 0;
  const frozenYesterday = frozen.has(addDays(today, -1));
  const moods = buildWidgetMoods({
    valid: dailyDataValid,
    streakDays: input.stats.streakDays,
    activeToday,
    readToday,
    goalMet: activeDays >= weeklyGoal,
    availableReviews,
    hasBook: current !== undefined,
    freezesAvailable,
    frozenYesterday,
  });
  const mood = moodAt(moods, input.now.getHours());
  const expires = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate() + 1);
  // Temporal claims are valid only until local midnight or one day after the oldest response.
  const expiresAt = dailyDataValid
    ? Math.min(expires.getTime(), input.updatedAt + 86_400_000)
    : new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime();
  const league = input.league && input.league.today === today ? input.league : null;
  return {
    version: 3 as const,
    today,
    updatedAt: input.updatedAt,
    expiresAt,
    hideBookOnLockScreen: input.hideBookOnLockScreen,
    streakDays: dailyDataValid ? input.stats.streakDays : 0,
    activeToday,
    weeklyGoal,
    activeDays,
    freeze: { available: freezesAvailable, max: freeze.max, frozenYesterday },
    week,
    month: buildWidgetMonth(
      today,
      new Set(input.stats.monthActiveDates.filter((date) => date <= today)),
      frozen,
    ),
    moods,
    pose: mood.pose,
    message: mood.message,
    tone: mood.tone,
    availableReviews,
    pendingReviews: dailyDataValid ? input.due.dueCount : 0,
    nextDueDate: input.due.nextDueDate,
    book: current
      ? {
          title: current.book.title,
          author: current.book.author ?? null,
          page: current.currentPage,
          totalPages: current.book.totalPages,
          progress: current.book.totalPages
            ? Math.min(100, Math.round((current.currentPage / current.book.totalPages) * 100))
            : null,
          coverUrl: current.book.coverUrls.find((url) => url.startsWith('https://')) ?? null,
          coverPalette: stableBucket(current.book.title, COVER_PALETTE_COUNT),
          url: `bubo://livro/${encodeURIComponent(current.id)}`,
          sessionUrl: `bubo://sessao/${encodeURIComponent(current.id)}`,
        }
      : null,
    league: league
      ? {
          rank: league.me.rank,
          previousRank: league.me.previousRank,
          participants: league.entries.length,
          weeklyXp: league.me.weeklyXp,
          daysLeft: league.daysLeft,
          podium: leaguePodium(league.entries, league.me.rank).map((entry) => ({
            rank: entry.rank,
            initials: nameInitials(entry.name),
            xp: entry.weeklyXp,
            me: entry.me,
          })),
        }
      : null,
    url: 'bubo:///',
    reviewUrl: 'bubo:///(tabs)/revisar',
    leagueUrl: 'bubo:///liga',
  };
}

/**
 * What a widget shows at `now` (mirrored by the Android/iOS widgets): today's mood while the
 * snapshot is fresh; otherwise an honest "open Bubo" state (or Bubo asleep at night) with a
 * title in place of the streak number.
 */
export function widgetMoodNow(
  snapshot: { today: string; expiresAt: number; moods: readonly WidgetMoodModel[] } | null,
  now: Date,
): WidgetMoodModel & { fresh: boolean; title: string | null } {
  const hour = now.getHours();
  if (!snapshot) {
    return {
      fromHour: 0,
      pose: 'welcome',
      message: 'Entre para ver sua sequência',
      lit: false,
      alert: false,
      tone: 'welcome',
      fresh: false,
      title: 'Olá!',
    };
  }
  const fresh = snapshot.expiresAt > now.getTime() && snapshot.today === toLocalIsoDate(now);
  if (!fresh) {
    const night = hour >= 22 || hour < 6;
    return {
      fromHour: 0,
      pose: night ? 'sleeping' : 'doubt',
      message: night ? 'Até amanhã!' : 'Para atualizar sua sequência',
      lit: false,
      alert: false,
      tone: night ? 'night' : 'stale',
      fresh,
      title: night ? 'Zzz…' : 'Abra o Bubo',
    };
  }
  return { ...moodAt(snapshot.moods, hour), fresh, title: null };
}
