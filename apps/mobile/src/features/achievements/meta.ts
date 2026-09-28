import { type Achievement } from '@bubo/contracts';
import { type ComponentProps } from 'react';

import { type Icon } from '../../design-system';
import { type ColorTokens } from '../../theme';

type IconName = ComponentProps<typeof Icon>['name'];

/** Section order, titles and colours for the "Mural de conquistas" (Stitch categories). */
export const CATEGORY_META: Record<
  Achievement['category'],
  { title: string; icon: IconName; soft: keyof ColorTokens; strong: keyof ColorTokens }
> = {
  reading: { title: 'Leitura & foco', icon: 'menu-book', soft: 'primarySoft', strong: 'primary' },
  memory: { title: 'Memória & recall', icon: 'psychology', soft: 'goldSoft', strong: 'goldRim' },
  consistency: {
    title: 'Constância',
    icon: 'local-fire-department',
    soft: 'orangeSoft',
    strong: 'orange',
  },
};

export const CATEGORY_ORDER: Achievement['category'][] = ['reading', 'memory', 'consistency'];

/** Badge glyph per achievement id; unknown ids (newer API) fall back to a medal. */
const ICONS: Record<string, IconName> = {
  first_session: 'auto-stories',
  ten_sessions: 'timer',
  ten_hours: 'hourglass-bottom',
  thousand_pages: 'layers',
  first_book: 'check-circle-outline',
  five_books: 'collections-bookmark',
  first_review: 'psychology',
  ten_remembered: 'lightbulb-outline',
  fifty_reviews: 'repeat',
  five_reflections: 'edit-note',
  streak_3: 'local-fire-department',
  streak_14: 'whatshot',
  streak_100: 'military-tech',
};

export function achievementIcon(id: string): IconName {
  return ICONS[id] ?? 'emoji-events';
}
