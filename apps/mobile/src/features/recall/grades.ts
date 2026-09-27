import { type ComponentProps } from 'react';

import { type ButtonVariant, type Icon } from '../../design-system';

type IconName = ComponentProps<typeof Icon>['name'];

/** Self-assessment after revealing the note (SM-2 grades). Copy follows the Stitch review screens. */
export const GRADE_OPTIONS: {
  grade: 1 | 3 | 4 | 5;
  label: string;
  hint: string;
  icon: IconName;
  variant: ButtonVariant;
}[] = [
  { grade: 1, label: 'Não lembrei', hint: 'Volta amanhã', icon: 'replay', variant: 'secondary' },
  {
    grade: 3,
    label: 'Com esforço',
    hint: 'Intervalo curto',
    icon: 'psychology',
    variant: 'secondary',
  },
  { grade: 4, label: 'Lembrei bem', hint: 'Intervalo maior', icon: 'check', variant: 'primary' },
  { grade: 5, label: 'Fácil', hint: 'Intervalo bem maior', icon: 'bolt', variant: 'success' },
];

/** ~30 s per card, rounded up — shown as an honest estimate, never a promise. */
export function estimatedMinutes(cards: number): number {
  return Math.max(1, Math.ceil(cards * 0.5));
}

/** "27 de set." from YYYY-MM-DD. */
export function dueLabel(isoDate: string, today: string): string {
  if (isoDate <= today) return 'hoje';
  const [, month, day] = isoDate.split('-').map(Number);
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
  return `${day ?? ''} de ${months[(month ?? 1) - 1] ?? ''}.`;
}
