import React, { useEffect } from 'react';
import { Brain, CircleDot, Sparkles, TrendingUp, WifiOff } from 'lucide-react';
import { useCoachStore } from '../../stores/useCoachStore';
import Card from '../ui/Card';
import ProgressBar from '../ui/ProgressBar';
import Skeleton from '../ui/Skeleton';

const trendCopy = {
  collecting: 'Construindo sua linha de base',
  improving: 'Sua profundidade está evoluindo',
  stable: 'Seu padrão está consistente',
  declining: 'Há espaço para recuperar profundidade',
};

export default function CognitiveProfileCard() {
  const { fetchProfile, isLoadingProfile, profile } = useCoachStore();

  useEffect(() => {
    if (!profile) fetchProfile().catch(() => {});
  }, [fetchProfile, profile]);

  if (isLoadingProfile && !profile) {
    return (
      <Card>
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="mt-3 h-8 w-2/3" />
        <Skeleton className="mt-6 h-4 w-full" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-4 h-4 w-full" />
      </Card>
    );
  }

  const coach = profile?.coach;
  const summary = profile?.summary || {};
  const dimensions = Object.values(profile?.dimensions || {});

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]">
            <Brain size={21} aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">AI Reading Coach</p>
            <h2 className="mt-1 text-xl font-black">Mapa cognitivo</h2>
          </div>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold ${coach?.connected ? 'bg-[rgb(var(--bubo-color-success)/0.1)] text-[rgb(var(--bubo-color-success))]' : 'bg-[rgb(var(--bubo-color-warning)/0.1)] text-[rgb(var(--bubo-color-warning))]'}`}>
          {coach?.connected ? <Sparkles size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
          {coach?.connected ? `${coach.provider} conectado` : 'Avaliador local'}
        </span>
      </div>

      {summary.totalReviews > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-3">
              <strong className="block text-xl">{summary.averageDepth || 0}%</strong>
              <span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">média</span>
            </div>
            <div className="rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-3">
              <strong className="block text-xl">{summary.highestDepth || 0}%</strong>
              <span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">melhor</span>
            </div>
            <div className="rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-3">
              <strong className="block text-xl">{summary.approvedReviews || 0}</strong>
              <span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">aprovadas</span>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {dimensions.map((dimension) => (
              <ProgressBar
                key={dimension.label}
                label={dimension.label}
                value={dimension.score}
                max={25}
                showValue
              />
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {profile.strongestDimension && (
              <div className="rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-success)/0.25)] bg-[rgb(var(--bubo-color-success)/0.07)] p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[rgb(var(--bubo-color-success))]">
                  <TrendingUp size={16} aria-hidden="true" /> Ponto forte
                </div>
                <p className="mt-2 font-bold">{profile.strongestDimension.label}</p>
              </div>
            )}
            {profile.growthDimension && (
              <div className="rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-primary)/0.2)] bg-[rgb(var(--bubo-color-primary)/0.06)] p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-[rgb(var(--bubo-color-primary))]">
                  <CircleDot size={16} aria-hidden="true" /> Próximo foco
                </div>
                <p className="mt-2 font-bold">{profile.growthDimension.label}</p>
              </div>
            )}
          </div>

          <div className="mt-5 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[rgb(var(--bubo-color-primary))]">Recomendação do Bubo</p>
            <p className="mt-2 text-sm leading-6">{profile.recommendation}</p>
            <p className="mt-3 text-xs text-[rgb(var(--bubo-color-text-muted))]">
              {trendCopy[summary.trend] || trendCopy.collecting}
              {summary.trendDelta ? ` · ${summary.trendDelta > 0 ? '+' : ''}${summary.trendDelta} pontos` : ''}
            </p>
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] px-4 py-6 text-center">
          <p className="font-bold">Seu mapa começa na primeira Deep Review.</p>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
            O Bubo acompanhará compreensão, especificidade, conexões e reflexão ao longo das suas leituras.
          </p>
        </div>
      )}
    </Card>
  );
}
