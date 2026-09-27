import { type Genre, type ReadingGoal, type ReadingHabit } from '@bubo/domain';
import { type ComponentProps } from 'react';

import { type Icon } from '../../design-system';

type IconName = ComponentProps<typeof Icon>['name'];
type Option<T> = { id: T; title: string; description?: string; icon: IconName };

/** pt-BR labels for onboarding answers (ids come from @bubo/domain). Copy follows Stitch. */
export const HABIT_OPTIONS: Option<ReadingHabit>[] = [
  {
    id: 'daily',
    title: 'Um pouco todo dia',
    description: '15 a 30 minutos diários de imersão',
    icon: 'calendar-today',
  },
  {
    id: 'weekly',
    title: 'Algumas vezes por semana',
    description: 'Sessões mais longas nos fins de semana',
    icon: 'date-range',
  },
  {
    id: 'free_time',
    title: 'Quando tenho tempo livre',
    description: 'Sem rotina fixa, leio por impulso',
    icon: 'schedule',
  },
  {
    id: 'restarting',
    title: 'Estou voltando a ler agora',
    description: 'Quero reconstruir o hábito do zero',
    icon: 'auto-stories',
  },
];

export const GOAL_OPTIONS: Option<ReadingGoal>[] = [
  {
    id: 'remember_more',
    title: 'Lembrar mais',
    description: 'Reter ideias centrais',
    icon: 'psychology',
  },
  {
    id: 'understand_better',
    title: 'Entender melhor',
    description: 'Explicar com suas palavras',
    icon: 'lightbulb-outline',
  },
  {
    id: 'build_habit',
    title: 'Criar hábito',
    description: 'Constância e sequência',
    icon: 'local-fire-department',
  },
  {
    id: 'read_more',
    title: 'Ler mais livros',
    description: 'Aumentar volume anual',
    icon: 'menu-book',
  },
  {
    id: 'technical_study',
    title: 'Livros técnicos',
    description: 'Estudo e aplicação',
    icon: 'science',
  },
  {
    id: 'reflect_stories',
    title: 'Refletir histórias',
    description: 'Ficção e narrativas',
    icon: 'auto-stories',
  },
];

export const GENRE_OPTIONS: Option<Genre>[] = [
  { id: 'science_fiction', title: 'Ficção científica', icon: 'rocket-launch' },
  { id: 'philosophy', title: 'Filosofia', icon: 'account-balance' },
  { id: 'fantasy', title: 'Fantasia', icon: 'auto-awesome' },
  { id: 'psychology', title: 'Psicologia', icon: 'psychology' },
  { id: 'history', title: 'História', icon: 'history-edu' },
  { id: 'business', title: 'Negócios', icon: 'work-outline' },
  { id: 'technology', title: 'Tecnologia', icon: 'computer' },
  { id: 'biography', title: 'Biografias', icon: 'person-outline' },
  { id: 'science', title: 'Ciência', icon: 'biotech' },
  { id: 'mystery', title: 'Suspense e mistério', icon: 'search' },
  { id: 'self_care', title: 'Autocuidado', icon: 'spa' },
];

export const ONBOARDING_TOTAL_STEPS = 6;
