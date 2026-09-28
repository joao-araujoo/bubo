/**
 * Memory rules derived only from recorded activity (reading sessions and graded reviews).
 * Nothing here estimates retention: every value is a count or a date the reader produced.
 */

/** How the reader graded one recall attempt (SM-2 grade → the three review buttons). */
export type ReviewOutcome = 'remembered' | 'almost' | 'forgot';

/** Lembrei = 4–5, Quase = 3, Esqueci = 0–2 (same split as `GET /v1/me/memory`). */
export function reviewOutcome(grade: number): ReviewOutcome {
  if (grade >= 4) return 'remembered';
  if (grade === 3) return 'almost';
  return 'forgot';
}

export type MemoryPathSession = {
  id: string;
  localDate: string;
  /** ISO timestamp, used to order events recorded on the same day. */
  endedAt: string;
  startPage: number;
  endPage: number;
  pagesRead: number;
  focusedSeconds: number;
};

export type MemoryPathReview = {
  id: string;
  localDate: string;
  reviewedAt: string;
  grade: number;
};

export type MemoryPathStep =
  | ({ kind: 'reading' } & Omit<MemoryPathSession, 'endedAt'> & { at: string })
  | { kind: 'review'; id: string; localDate: string; at: string; outcome: ReviewOutcome }
  | {
      kind: 'next';
      /** `today` when something is already due, otherwise the earliest future due date. */
      localDate: string;
      isDue: boolean;
      /** Cards due on or before today (isDue) or on that future date. */
      cardCount: number;
    };

/** Past steps shown on the book screen; older activity stays in the session history. */
export const MEMORY_PATH_MAX_PAST = 8;

/**
 * The book's "Caminho de memória": its most recent reading sessions and reviews in chronological
 * order, followed by the next scheduled review when the book has recall cards.
 */
export function buildMemoryPath(input: {
  today: string;
  sessions: readonly MemoryPathSession[];
  reviews: readonly MemoryPathReview[];
  cardDueDates: readonly string[];
  maxPast?: number;
}): MemoryPathStep[] {
  const past: Exclude<MemoryPathStep, { kind: 'next' }>[] = [
    ...input.sessions.map(({ endedAt, ...session }) => ({
      kind: 'reading' as const,
      ...session,
      at: endedAt,
    })),
    ...input.reviews.map((review) => ({
      kind: 'review' as const,
      id: review.id,
      localDate: review.localDate,
      at: review.reviewedAt,
      outcome: reviewOutcome(review.grade),
    })),
  ].sort((a, b) =>
    a.localDate === b.localDate
      ? Date.parse(a.at) - Date.parse(b.at)
      : a.localDate < b.localDate
        ? -1
        : 1,
  );
  const steps: MemoryPathStep[] = past.slice(-(input.maxPast ?? MEMORY_PATH_MAX_PAST));

  const due = input.cardDueDates.filter((date) => date <= input.today).length;
  if (due > 0) {
    steps.push({ kind: 'next', localDate: input.today, isDue: true, cardCount: due });
  } else if (input.cardDueDates.length > 0) {
    const earliest = input.cardDueDates.reduce((min, date) => (date < min ? date : min));
    steps.push({
      kind: 'next',
      localDate: earliest,
      isDue: false,
      cardCount: input.cardDueDates.filter((date) => date === earliest).length,
    });
  }
  return steps;
}

export type MemoryDay = { date: string; remembered: number; almost: number; forgot: number };

export type MemorySummary = {
  total: number;
  remembered: number;
  almost: number;
  forgot: number;
  /** Days with at least one recorded review. */
  activeDays: number;
  /** Share of attempts graded "Lembrei" (0–100, rounded), or null with no attempts. */
  rememberedPercent: number | null;
  /** Largest daily total, for scaling a chart (0 with no attempts). */
  busiestDay: number;
};

/** Totals for the "Minha memória" screen. Self-assessments, not a retention estimate. */
export function summarizeMemoryDays(days: readonly MemoryDay[]): MemorySummary {
  let remembered = 0;
  let almost = 0;
  let forgot = 0;
  let activeDays = 0;
  let busiestDay = 0;
  for (const day of days) {
    const count = day.remembered + day.almost + day.forgot;
    remembered += day.remembered;
    almost += day.almost;
    forgot += day.forgot;
    if (count > 0) activeDays += 1;
    busiestDay = Math.max(busiestDay, count);
  }
  const total = remembered + almost + forgot;
  return {
    total,
    remembered,
    almost,
    forgot,
    activeDays,
    rememberedPercent: total === 0 ? null : Math.round((remembered / total) * 100),
    busiestDay,
  };
}
