import React, { useEffect } from 'react';
import { BookOpen, Brain, Flame, Gem, Medal, Target, Trophy, Zap } from 'lucide-react';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import Skeleton from '../components/ui/Skeleton';
import { useAchievementStore } from '../stores/useAchievementStore';
import { useDashboardStore } from '../stores/useDashboardStore';

const achievementCopy = {
  first_review: { title: 'Primeiro passo', description: 'Complete sua primeira Deep Review.', Icon: Medal },
  ten_reviews: { title: 'Mergulho profundo', description: 'Complete 10 Deep Reviews.', Icon: Target },
  fifty_reviews: { title: 'Filósofo', description: 'Complete 50 Deep Reviews.', Icon: Brain },
  first_book: { title: 'Leitor iniciado', description: 'Conclua seu primeiro livro.', Icon: BookOpen },
  five_books: { title: 'Bibliófilo', description: 'Conclua 5 livros.', Icon: Trophy },
  high_depth: { title: 'Elite cognitiva', description: 'Alcance 90% ou mais de profundidade.', Icon: Zap },
  streak_7: { title: 'Semana ativa', description: 'Mantenha uma sequência de 7 dias.', Icon: Flame },
  hundred_pages: { title: 'Centenário', description: 'Valide 100 páginas de leitura.', Icon: Gem },
};

const rarityLabels = {
  common: 'Comum',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Lendária',
};

const challengeIcons = {
  annual_goal: Target,
  deep_week: Brain,
  premium_synthesis: Gem,
};

export default function AchievementsPage() {
  const { achievements, error, fetchAchievements, isLoading } = useAchievementStore();
  const { dashboard, fetchDashboard, isLoading: dashboardLoading } = useDashboardStore();

  useEffect(() => {
    fetchAchievements().catch(() => {});
    fetchDashboard().catch(() => {});
  }, [fetchAchievements, fetchDashboard]);

  const challenges = dashboard?.challenges || [];

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Gamificação educativa</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.03em]">Conquistas por profundidade</h1>
        <p className="mt-2 max-w-2xl leading-7 text-[rgb(var(--bubo-color-text-muted))]">O Bubo recompensa consistência, síntese e retenção — não apenas quantidade de páginas.</p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card>
          <h2 className="text-xl font-black">Missões ativas</h2>
          {dashboardLoading ? (
            <div className="mt-5 space-y-4">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 w-full" />)}
            </div>
          ) : challenges.length === 0 ? (
            <EmptyState className="mt-5" title="Missões indisponíveis" description="As missões voltarão a aparecer quando o painel for sincronizado." />
          ) : (
            <div className="mt-5 space-y-4">
              {challenges.map((challenge) => {
                const Icon = challengeIcons[challenge.id] || Target;
                return (
                  <div key={challenge.id} className="rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] p-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><Icon size={20} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3"><strong>{challenge.title}</strong><span className="text-xs font-extrabold text-[rgb(var(--bubo-color-primary))]">+{challenge.xp} XP</span></div>
                        <p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{challenge.description}</p>
                        <ProgressBar className="mt-3" value={challenge.current} max={challenge.target} showValue />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-48 w-full" rounded="lg" />)}
          </div>
        ) : error && achievements.length === 0 ? (
          <EmptyState title="Não foi possível carregar suas conquistas" description={error} actionLabel="Tentar novamente" onAction={() => fetchAchievements().catch(() => {})} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {achievements.map((achievement) => {
              const localized = achievementCopy[achievement.id] || { title: achievement.name, description: achievement.description, Icon: Trophy };
              const Icon = localized.Icon;
              return (
                <Card key={achievement.id} className={!achievement.unlocked ? 'opacity-70' : ''}>
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${achievement.unlocked ? 'bg-[rgb(var(--bubo-color-primary)/0.13)] text-[rgb(var(--bubo-color-primary))]' : 'bg-[rgb(var(--bubo-color-surface-muted))] text-[rgb(var(--bubo-color-text-muted))]'}`}><Icon size={22} /></span>
                    <div>
                      <h2 className="font-extrabold">{localized.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{localized.description}</p>
                    </div>
                  </div>
                  <ProgressBar className="mt-5" value={achievement.current} max={achievement.threshold} showValue />
                  <p className="mt-3 text-xs text-[rgb(var(--bubo-color-text-muted))]">{achievement.unlocked ? 'Desbloqueada' : `${achievement.progress}% concluída`} · {rarityLabels[achievement.rarity] || achievement.rarity}</p>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
