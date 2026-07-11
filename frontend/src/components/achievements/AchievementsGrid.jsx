import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import AchievementBadge from './AchievementBadge';
import api from '../../services/api';

const FALLBACK_ACHIEVEMENTS = [
  { id: 'first_review', name: 'Primeiro passo', description: 'Conclua sua primeira Deep Review.', iconKey: 'sparkles', unlocked: false },
  { id: 'ten_reviews', name: 'Leitura profunda', description: 'Conclua 10 Deep Reviews.', iconKey: 'target', unlocked: false },
  { id: 'fifty_reviews', name: 'Leitor reflexivo', description: 'Conclua 50 Deep Reviews.', iconKey: 'brain', unlocked: false },
  { id: 'first_book', name: 'Primeiro livro', description: 'Finalize seu primeiro livro.', iconKey: 'book_open', unlocked: false },
  { id: 'five_books', name: 'Biblioteca viva', description: 'Finalize 5 livros.', iconKey: 'library', unlocked: false },
  { id: 'high_depth', name: 'Síntese premium', description: 'Alcance 90 ou mais de profundidade cognitiva.', iconKey: 'medal', unlocked: false },
  { id: 'streak_7', name: 'Semana ativa', description: 'Mantenha uma sequência de leitura por 7 dias.', iconKey: 'flame', unlocked: false },
  { id: 'hundred_pages', name: 'Cem páginas', description: 'Registre 100 páginas validadas.', iconKey: 'book_open', unlocked: false },
];

export default function AchievementsGrid() {
  const { data, isLoading } = useQuery({
    queryKey: ['achievements'],
    queryFn: () => api.get('/achievements').then((response) => response.data.achievements),
    onError: () => {},
  });

  const achievements = data || FALLBACK_ACHIEVEMENTS;
  const unlocked = achievements.filter((achievement) => achievement.unlocked).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" role="status" aria-label="Carregando conquistas">
        <Loader2 size={32} className="animate-spin text-[rgb(var(--bubo-color-primary))]" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-[rgb(var(--bubo-color-text-muted))]">
        {unlocked} de {achievements.length} conquistas desbloqueadas
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {achievements.map((achievement, index) => (
          <AchievementBadge key={achievement.id} achievement={achievement} index={index} />
        ))}
      </div>
    </div>
  );
}
