import React from 'react';
import { Brain, Flame, Gem, Medal, Target, Trophy } from 'lucide-react';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';

const achievements = [
  { title: 'Primeiro passo', description: 'Complete sua primeira validação com o Bubo.', progress: 100, rarity: 'Comum', unlocked: true, Icon: Medal },
  { title: 'Semana ativa', description: 'Mantenha uma sequência de 7 dias com Deep Reviews.', progress: 14, rarity: 'Rara', unlocked: false, Icon: Flame },
  { title: 'Leitura profunda', description: 'Alcance 90% ou mais em uma Deep Review.', progress: 96, rarity: 'Épica', unlocked: false, Icon: Gem },
  { title: 'Desafio anual', description: 'Conclua sua meta anual de livros.', progress: 10, rarity: 'Lendária', unlocked: false, Icon: Trophy },
];

const missions = [
  { title: 'Meta anual', value: 2, max: 20, xp: 350, Icon: Target },
  { title: 'Semana profunda', value: 1, max: 3, xp: 180, Icon: Brain },
  { title: 'Síntese premium', value: 1, max: 5, xp: 240, Icon: Gem },
];

export default function AchievementsPage() {
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
          <div className="mt-5 space-y-4">
            {missions.map(({ Icon, max, title, value, xp }) => (
              <div key={title} className="rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] p-4">
                <div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><Icon size={20} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><strong>{title}</strong><span className="text-xs font-extrabold text-[rgb(var(--bubo-color-primary))]">+{xp} XP</span></div><ProgressBar className="mt-3" value={value} max={max} showValue /></div></div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          {achievements.map(({ Icon, description, progress, rarity, title, unlocked }) => (
            <Card key={title} className={!unlocked ? 'opacity-70' : ''}>
              <div className="flex items-start gap-3"><span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${unlocked ? 'bg-[rgb(var(--bubo-color-primary)/0.13)] text-[rgb(var(--bubo-color-primary))]' : 'bg-[rgb(var(--bubo-color-surface-muted))] text-[rgb(var(--bubo-color-text-muted))]'}`}><Icon size={22} /></span><div><h2 className="font-extrabold">{title}</h2><p className="mt-1 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{description}</p></div></div>
              <ProgressBar className="mt-5" value={progress} max={100} />
              <p className="mt-3 text-xs text-[rgb(var(--bubo-color-text-muted))]">{unlocked ? 'Desbloqueada' : `${progress}% concluída`} · {rarity}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
