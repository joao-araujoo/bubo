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

type Scene =
  | 'sky'
  | 'teal'
  | 'sunset'
  | 'alarm'
  | 'night'
  | 'gold'
  | 'mint'
  | 'candy'
  | 'periwinkle'
  | 'slate'
  | 'lavender';
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
  | 'doubt';
type Mood = { fromHour: number; scene: Scene; pose: Pose; message: string; lit: boolean };
/** `alert` adds the red "!" badge to the flame while the streak is at risk. */
export type WidgetMoodModel = Mood & { alert: boolean };

/** Hours (local) where the widget mood may change; natives schedule timeline entries on them. */
export const WIDGET_MOOD_HOURS = [0, 6, 18, 21, 22] as const;

/**
 * Today's moods, Duolingo-style: calm in the morning, a nudge in the evening, "last chance" late
 * at night while the streak is at risk, celebration once there is real activity today.
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
}): WidgetMoodModel[] {
  return moods(input).map((mood) => ({
    ...mood,
    alert: mood.scene === 'sunset' || mood.scene === 'alarm',
  }));
}

function moods(input: Parameters<typeof buildWidgetMoods>[0]): Mood[] {
  if (!input.valid) {
    return [{ fromHour: 0, scene: 'slate', pose: 'doubt', message: 'Abra o Bubo', lit: false }];
  }
  const lit = input.activeToday;
  const sleeping: Mood = {
    fromHour: 0,
    scene: 'night',
    pose: 'sleeping',
    message: lit ? 'Missão cumprida. Bons sonhos!' : 'Zzz… hora de descansar',
    lit,
  };
  if (lit) {
    const done: Mood = input.goalMet
      ? { fromHour: 6, scene: 'mint', pose: 'achievement', message: 'Meta da semana!', lit }
      : input.readToday
        ? { fromHour: 6, scene: 'gold', pose: 'celebrating', message: 'Leitura feita hoje!', lit }
        : { fromHour: 6, scene: 'gold', pose: 'cheering', message: 'Revisão feita hoje!', lit };
    return [sleeping, done, { ...sleeping, fromHour: 22 }];
  }
  const reviews = input.availableReviews;
  const day: Mood =
    reviews > 0
      ? {
          fromHour: 6,
          scene: 'teal',
          pose: 'review',
          message: reviews === 1 ? '1 revisão te espera' : `${reviews} revisões te esperam`,
          lit,
        }
      : input.hasBook
        ? { fromHour: 6, scene: 'sky', pose: 'reading', message: 'Bora ler um pouquinho?', lit }
        : input.streakDays > 0
          ? { fromHour: 6, scene: 'sky', pose: 'happy', message: 'Bora manter o ritmo?', lit }
          : { fromHour: 6, scene: 'candy', pose: 'welcome', message: 'Que tal começar hoje?', lit };
  if (input.streakDays === 0) return [sleeping, day, { ...sleeping, fromHour: 22 }];
  return [
    sleeping,
    day,
    { fromHour: 18, scene: 'sunset', pose: 'worried', message: 'Salve sua sequência!', lit },
    { fromHour: 21, scene: 'alarm', pose: 'surprised', message: 'Está ficando tarde!', lit },
    { fromHour: 22, scene: 'alarm', pose: 'worried', message: 'Última chance!', lit },
  ];
}

/** The mood in effect at `hour` (moods are sorted by `fromHour`, the first one starts at 0). */
export function moodAt<T extends { fromHour: number }>(moods: readonly T[], hour: number): T {
  return moods.reduce((current, mood) => (mood.fromHour <= hour ? mood : current), moods[0]!);
}

/** Month calendar, Monday first; consecutive active days in the same row form a run. */
export function buildWidgetMonth(today: string, activeDates: ReadonlySet<string>) {
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
  return { label: MONTH_LABELS_PT[month - 1] ?? '', offset, days };
}

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
    book: { title: string; totalPages: number | null; coverUrls: readonly string[] };
  }[];
  stats: {
    today: string;
    streakDays: number;
    weekReadingDates: readonly string[];
    weekActiveDates: readonly string[];
    monthActiveDates: readonly string[];
    readToday: boolean;
    reviewedToday: boolean;
  };
  due: { today: string; cards: readonly unknown[]; dueCount: number; nextDueDate: string | null };
}) {
  const today = toLocalIsoDate(input.now);
  const current = input.entries.find((entry) => entry.status === 'reading');
  const weekStart = startOfWeek(today);
  const dailyDataValid = input.stats.today === today && input.due.today === today;
  // Activity claims for today are only honest while the stats belong to today.
  const activeToday = dailyDataValid && (input.stats.readToday || input.stats.reviewedToday);
  const readToday = dailyDataValid && input.stats.readToday;
  const week = WEEKDAY_LABELS_PT.map((label, i) => {
    const date = addDays(weekStart, i);
    const past = date <= today;
    return {
      label,
      date,
      active: past && input.stats.weekActiveDates.includes(date),
      read: past && input.stats.weekReadingDates.includes(date),
      state:
        date === today
          ? ('today' as const)
          : date > today
            ? ('future' as const)
            : input.stats.weekActiveDates.includes(date)
              ? ('done' as const)
              : ('missed' as const),
    };
  });
  const activeDays = week.filter((day) => day.read).length;
  const weeklyGoal = Math.min(7, Math.max(1, Math.floor(input.weeklyGoal)));
  const availableReviews = dailyDataValid ? input.due.cards.length : 0;
  const moods = buildWidgetMoods({
    valid: dailyDataValid,
    streakDays: input.stats.streakDays,
    activeToday,
    readToday,
    goalMet: activeDays >= weeklyGoal,
    availableReviews,
    hasBook: current !== undefined,
  });
  const mood = moodAt(moods, input.now.getHours());
  const expires = new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate() + 1);
  // Temporal claims are valid only until local midnight or one day after the oldest response.
  const expiresAt = dailyDataValid
    ? Math.min(expires.getTime(), input.updatedAt + 86_400_000)
    : new Date(input.now.getFullYear(), input.now.getMonth(), input.now.getDate()).getTime();
  return {
    version: 2 as const,
    today,
    updatedAt: input.updatedAt,
    expiresAt,
    hideBookOnLockScreen: input.hideBookOnLockScreen,
    streakDays: dailyDataValid ? input.stats.streakDays : 0,
    activeToday,
    weeklyGoal,
    activeDays,
    week,
    month: buildWidgetMonth(
      today,
      new Set(input.stats.monthActiveDates.filter((date) => date <= today)),
    ),
    moods,
    scene: mood.scene,
    pose: mood.pose,
    message: mood.message,
    availableReviews,
    pendingReviews: dailyDataValid ? input.due.dueCount : 0,
    nextDueDate: input.due.nextDueDate,
    book: current
      ? {
          title: current.book.title,
          page: current.currentPage,
          totalPages: current.book.totalPages,
          progress: current.book.totalPages
            ? Math.min(100, Math.round((current.currentPage / current.book.totalPages) * 100))
            : null,
          coverUrl: current.book.coverUrls.find((url) => url.startsWith('https://')) ?? null,
          url: `bubo://livro/${encodeURIComponent(current.id)}`,
          sessionUrl: `bubo://sessao/${encodeURIComponent(current.id)}`,
        }
      : null,
    url: 'bubo:///(tabs)',
    reviewUrl: 'bubo:///(tabs)/revisar',
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
      scene: 'lavender',
      pose: 'welcome',
      message: 'Entre no app para começar',
      lit: false,
      alert: false,
      fresh: false,
      title: 'Olá!',
    };
  }
  const fresh = snapshot.expiresAt > now.getTime() && snapshot.today === toLocalIsoDate(now);
  if (!fresh) {
    const night = hour >= 22 || hour < 6;
    return {
      fromHour: 0,
      scene: night ? 'night' : 'slate',
      pose: night ? 'sleeping' : 'doubt',
      message: night ? 'Até amanhã!' : 'Para atualizar sua sequência',
      lit: false,
      alert: false,
      fresh,
      title: night ? 'Zzz…' : 'Abra o Bubo',
    };
  }
  return { ...moodAt(snapshot.moods, hour), fresh, title: null };
}
