import { type ComponentProps } from 'react';

import { type ButtonVariant, type Icon } from '../../design-system';
import { type MascotState } from '../../assets/registry';
import { type ColorTokens } from '../../theme';

type IconName = ComponentProps<typeof Icon>['name'];

/** Self-assessment after revealing the note (SM-2 grades). Copy follows the Stitch review screens. */
export const GRADE_OPTIONS: {
  grade: 1 | 3 | 4 | 5;
  label: string;
  hint: string;
  icon: IconName;
  variant: ButtonVariant;
  mascot: MascotState;
  color: keyof ColorTokens;
  message: string;
}[] = [
  {
    grade: 4,
    label: 'Lembrei',
    hint: 'Lembrei bem. Intervalo maior',
    icon: 'check',
    variant: 'primary',
    mascot: 'recallCorrect',
    color: 'success',
    message: 'A ideia ficou com você. Continue cultivando essa lembrança.',
  },
  {
    grade: 3,
    label: 'Quase',
    hint: 'Lembrei com esforço. Intervalo curto',
    icon: 'psychology',
    variant: 'secondary',
    mascot: 'recallPartial',
    color: 'warning',
    message: 'Você encontrou parte do caminho. Rever ajuda a ligar as ideias.',
  },
  {
    grade: 1,
    label: 'Esqueci',
    hint: 'Não lembrei. Volta amanhã',
    icon: 'replay',
    variant: 'secondary',
    mascot: 'recallIncorrect',
    color: 'purpleLight',
    message: 'Tudo bem esquecer. Esta lembrança terá outra oportunidade.',
  },
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
