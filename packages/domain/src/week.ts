/** Short Portuguese weekday labels, Monday first (matches the "Sua semana cognitiva" card). */
export const WEEKDAY_LABELS_PT = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'] as const;

export type WeekDayState = 'done' | 'missed' | 'today' | 'today_done' | 'future';

export type WeekDay = {
  /** Local calendar date, YYYY-MM-DD. */
  isoDate: string;
  label: (typeof WEEKDAY_LABELS_PT)[number];
  state: WeekDayState;
};

/** Formats a Date as a local calendar date (YYYY-MM-DD), independent of the UTC offset. */
export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Builds the Monday→Sunday week containing `today`.
 * `activeDates` holds the local dates on which the reader completed a cognitive activity.
 * With no activity data every past day is `missed`, so the UI never shows invented progress.
 */
export function buildCognitiveWeek(
  today: Date,
  activeDates: ReadonlySet<string> = new Set(),
): WeekDay[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  const todayIso = toLocalIsoDate(today);

  return WEEKDAY_LABELS_PT.map((label, index) => {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const isoDate = toLocalIsoDate(day);
    const active = activeDates.has(isoDate);
    let state: WeekDayState;
    if (isoDate === todayIso) state = active ? 'today_done' : 'today';
    else if (isoDate > todayIso) state = 'future';
    else state = active ? 'done' : 'missed';
    return { isoDate, label, state };
  });
}

/** Number of days with completed activity in the week (today counts only when done). */
export function countActiveDays(week: readonly WeekDay[]): number {
  return week.filter((d) => d.state === 'done' || d.state === 'today_done').length;
}
