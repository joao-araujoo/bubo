import { type ClubIcon, type ReportRequest } from '@bubo/contracts';
import { type ReactionKind, type TopicKind } from '@bubo/domain';
import { type ComponentProps } from 'react';

import { type Icon, type PillTone } from '../../design-system';
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
export const WEEKLY_GOAL_CHOICES: { value: 50 | 75 | 100; label: string; short: string }[] = [
  { value: 50, label: 'Leve (50p)', short: 'Leve' },
  { value: 75, label: 'Médio (75p)', short: 'Médio' },
  { value: 100, label: 'Intenso (100p)', short: 'Intenso' },
];

/** Stitch "Tipo de discussão" tiles and topic pills. */
export const TOPIC_KIND_META: Record<TopicKind, { label: string; icon: IconName; tone: PillTone }> =
  {
    discussion: { label: 'Debate', icon: 'forum', tone: 'primary' },
    philosophical: { label: 'Filosófico', icon: 'account-balance', tone: 'primary' },
    worldbuilding: { label: 'Worldbuilding', icon: 'public', tone: 'success' },
    character: { label: 'Personagem', icon: 'theater-comedy', tone: 'orange' },
    question: { label: 'Dúvida conceitual', icon: 'help-outline', tone: 'error' },
  };

/** Kinds offered when writing (the default "Debate" stays implicit). */
export const TOPIC_KIND_CHOICES: TopicKind[] = [
  'philosophical',
  'worldbuilding',
  'character',
  'question',
];

/** Stitch reaction pills ("Fez pensar", "Novo ponto", "Bom contraponto"). */
export const REACTION_META: Record<ReactionKind, { label: string; icon: IconName }> = {
  insight: { label: 'Fez pensar', icon: 'psychology' },
  idea: { label: 'Novo ponto', icon: 'lightbulb-outline' },
  counterpoint: { label: 'Bom contraponto', icon: 'compare-arrows' },
};

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

/** "Encerra em 2 dias", "Encerra hoje", "Encerrada". */
export function closesLabel(closesAt: string, isOpen: boolean, now = new Date()): string {
  if (!isOpen) return 'Encerrada';
  const hours = (new Date(closesAt).getTime() - now.getTime()) / 3_600_000;
  if (hours < 24) return 'Encerra hoje';
  const days = Math.ceil(hours / 24);
  return days === 1 ? 'Encerra em 1 dia' : `Encerra em ${days} dias`;
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

export function votesLabel(count: number): string {
  return count === 1 ? '1 voto' : `${count} votos`;
}

/** "Cap. 22 • Pág. 310" (only what the author declared). */
export function anchorLabel(chapter: number | null, page: number): string {
  const pageText = page > 0 ? `Pág. ${page}` : 'Geral';
  return chapter ? `Cap. ${chapter} • ${pageText}` : pageText;
}
