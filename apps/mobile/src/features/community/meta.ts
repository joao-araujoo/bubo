import { type ClubIcon, type ReportRequest } from '@bubo/contracts';
import { type ComponentProps } from 'react';

import { type Icon } from '../../design-system';
import { shortDate } from '../shelf/labels';

type IconName = ComponentProps<typeof Icon>['name'];

/** Club badge choices (Stitch "Ícone do clube"), rendered with Material icons, never emoji. */
export const CLUB_ICON_META: Record<ClubIcon, { icon: IconName; label: string }> = {
  planet: { icon: 'public', label: 'Universo' },
  classics: { icon: 'account-balance', label: 'Clássicos' },
  mind: { icon: 'psychology', label: 'Mente' },
  spark: { icon: 'bolt', label: 'Energia' },
  library: { icon: 'local-library', label: 'Biblioteca' },
  heart: { icon: 'favorite-border', label: 'Afeto' },
};

export const CLUB_ICON_ORDER: ClubIcon[] = [
  'planet',
  'classics',
  'mind',
  'spark',
  'library',
  'heart',
];

/** Stitch "Meta de ritmo coletivo". */
export const WEEKLY_GOAL_CHOICES: { value: 50 | 75 | 100 | null; label: string }[] = [
  { value: null, label: 'Sem meta' },
  { value: 50, label: 'Leve · 50 págs.' },
  { value: 75, label: 'Médio · 75 págs.' },
  { value: 100, label: 'Intenso · 100 págs.' },
];

export const REPORT_REASONS: { value: ReportRequest['reason']; label: string }[] = [
  { value: 'spoiler', label: 'Spoiler sem página certa' },
  { value: 'offensive', label: 'Ofensivo ou ataque pessoal' },
  { value: 'spam', label: 'Spam ou propaganda' },
  { value: 'other', label: 'Outro motivo' },
];

/** "agora", "há 5 min", "há 3 h", "ontem", then "27 de set.". */
export function relativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  if (hours < 48) return 'ontem';
  const y = then.getFullYear();
  const m = String(then.getMonth() + 1).padStart(2, '0');
  const d = String(then.getDate()).padStart(2, '0');
  return shortDate(`${y}-${m}-${d}`);
}

export function pagesLabel(count: number): string {
  return count === 1 ? '1 página' : `${count} páginas`;
}

export function membersLabel(count: number): string {
  return count === 1 ? '1 leitor' : `${count} leitores`;
}

export function topicsLabel(count: number): string {
  return count === 1 ? '1 debate' : `${count} debates`;
}
