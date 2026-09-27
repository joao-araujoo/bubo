import { type ReadingStatus } from '@bubo/domain';
import { type ComponentProps } from 'react';

import { type ChipTone, type Icon } from '../../design-system';

type IconName = ComponentProps<typeof Icon>['name'];

/** pt-BR labels for reading statuses (ids come from @bubo/domain). Order = shelf sections. */
export const STATUS_META: Record<
  ReadingStatus,
  { label: string; section: string; tone: ChipTone; icon: IconName }
> = {
  reading: { label: 'Lendo', section: 'Lendo agora', tone: 'primary', icon: 'auto-stories' },
  want_to_read: {
    label: 'Quero ler',
    section: 'Quero ler',
    tone: 'neutral',
    icon: 'bookmark-border',
  },
  paused: { label: 'Pausado', section: 'Pausados', tone: 'orange', icon: 'pause-circle-outline' },
  finished: {
    label: 'Terminado',
    section: 'Terminados',
    tone: 'success',
    icon: 'check-circle-outline',
  },
  abandoned: { label: 'Abandonado', section: 'Abandonados', tone: 'neutral', icon: 'block' },
};

export const STATUS_ORDER: ReadingStatus[] = [
  'reading',
  'want_to_read',
  'paused',
  'finished',
  'abandoned',
];

/** "26 de set." style short date for session history. */
export function shortDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const months = [
    'jan',
    'fev',
    'mar',
    'abr',
    'mai',
    'jun',
    'jul',
    'ago',
    'set',
    'out',
    'nov',
    'dez',
  ];
  if (!year || !month || !day) return isoDate;
  return `${day} de ${months[month - 1] ?? ''}.`;
}
