import { addDays } from './streak';

/**
 * Achievements derived only from recorded activity (ADR-018). Nothing is granted manually and
 * nothing is stored: every badge is recomputed from sessions, reviews, cards and the shelf.
 */

export type AchievementCategory = 'reading' | 'memory' | 'consistency';

/** Real counts the API aggregates for one reader. */
export type AchievementMetrics = {
  sessions: number;
  focusedMinutes: number;
  pagesRead: number;
  booksFinished: number;
  reflections: number;
  reviews: number;
  /** Reviews graded "Lembrei" (grade ≥ 4). */
  remembered: number;
  /** Longest run of consecutive days with a session or a review. */
  longestStreak: number;
};

type Metric = keyof AchievementMetrics;

/** Stitch medal tiers: a fixed difficulty class per badge (never earned separately). */
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'diamond';

export type AchievementDefinition = {
  id: string;
  category: AchievementCategory;
  tier: AchievementTier;
  title: string;
  description: string;
  metric: Metric;
  target: number;
};

/** The catalogue, in display order. Ids are stable (clients may key on them). */
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: 'first_session',
    category: 'reading',
    tier: 'bronze',
    title: 'Primeira página',
    description: 'Conclua sua primeira sessão de leitura focada.',
    metric: 'sessions',
    target: 1,
  },
  {
    id: 'ten_sessions',
    category: 'reading',
    tier: 'silver',
    title: 'Leitor focado',
    description: 'Conclua 10 sessões de leitura focada.',
    metric: 'sessions',
    target: 10,
  },
  {
    id: 'ten_hours',
    category: 'reading',
    tier: 'gold',
    title: 'Dez horas de foco',
    description: 'Some 600 minutos de leitura focada.',
    metric: 'focusedMinutes',
    target: 600,
  },
  {
    id: 'thousand_pages',
    category: 'reading',
    tier: 'gold',
    title: 'Mil páginas',
    description: 'Avance 1.000 páginas em sessões de leitura.',
    metric: 'pagesRead',
    target: 1000,
  },
  {
    id: 'first_book',
    category: 'reading',
    tier: 'silver',
    title: 'Livro concluído',
    description: 'Marque um livro como terminado na sua estante.',
    metric: 'booksFinished',
    target: 1,
  },
  {
    id: 'five_books',
    category: 'reading',
    tier: 'diamond',
    title: 'Estante viva',
    description: 'Termine 5 livros.',
    metric: 'booksFinished',
    target: 5,
  },
  {
    id: 'first_review',
    category: 'memory',
    tier: 'bronze',
    title: 'Primeira lembrança',
    description: 'Faça sua primeira revisão sem espiar.',
    metric: 'reviews',
    target: 1,
  },
  {
    id: 'ten_remembered',
    category: 'memory',
    tier: 'silver',
    title: 'Recall puro',
    description: 'Marque “Lembrei” em 10 revisões.',
    metric: 'remembered',
    target: 10,
  },
  {
    id: 'fifty_reviews',
    category: 'memory',
    tier: 'gold',
    title: 'Revisor dedicado',
    description: 'Complete 50 revisões.',
    metric: 'reviews',
    target: 50,
  },
  {
    id: 'five_reflections',
    category: 'memory',
    tier: 'silver',
    title: 'Leitor reflexivo',
    description: 'Escreva o que ficou com você ao fim de 5 sessões.',
    metric: 'reflections',
    target: 5,
  },
  {
    id: 'streak_3',
    category: 'consistency',
    tier: 'bronze',
    title: 'Três dias seguidos',
    description: 'Leia ou revise em 3 dias consecutivos.',
    metric: 'longestStreak',
    target: 3,
  },
  {
    id: 'streak_14',
    category: 'consistency',
    tier: 'gold',
    title: 'Hábito de ferro',
    description: 'Leia ou revise em 14 dias consecutivos.',
    metric: 'longestStreak',
    target: 14,
  },
  {
    id: 'streak_100',
    category: 'consistency',
    tier: 'diamond',
    title: 'Centurião',
    description: 'Leia ou revise em 100 dias consecutivos.',
    metric: 'longestStreak',
    target: 100,
  },
];

export type AchievementStatus = Omit<AchievementDefinition, 'metric'> & {
  /** Current value, capped at the target. */
  progress: number;
  unlocked: boolean;
};

export function evaluateAchievements(metrics: AchievementMetrics): AchievementStatus[] {
  return ACHIEVEMENTS.map(({ metric, ...definition }) => {
    const value = Math.max(0, Math.floor(metrics[metric]));
    return {
      ...definition,
      progress: Math.min(value, definition.target),
      unlocked: value >= definition.target,
    };
  });
}

/** Longest run of consecutive calendar days in `dates` (YYYY-MM-DD, any order, duplicates ok). */
export function longestStreak(dates: Iterable<string>): number {
  const sorted = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of sorted) {
    run = previous !== null && addDays(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
}
