import React, { useEffect } from 'react';
import { BookOpen, Brain, RefreshCw, Sparkles, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';
import CognitiveProfileCard from '../components/deepReview/CognitiveProfileCard';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { useCoachStore } from '../stores/useCoachStore';
import { formatRelativeTime } from '../utils/formatters';

export default function CoachPage() {
  const { fetchProfile, isLoadingProfile, profile } = useCoachStore();

  useEffect(() => {
    fetchProfile().catch((error) => toast.error(error.message));
  }, [fetchProfile]);

  const books = profile?.books || [];
  const coach = profile?.coach;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="overflow-hidden rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] shadow-[var(--bubo-shadow-sm)]">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">
              <Sparkles size={14} aria-hidden="true" /> AI Reading Coach
            </p>
            <h1 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.035em] sm:text-4xl">
              Entenda como você lê, não apenas quanto você lê.
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-[rgb(var(--bubo-color-text-muted))]">
              O Bubo acompanha compreensão, evidências, conexões e reflexão para transformar cada Deep Review em um mapa de evolução cognitiva.
            </p>
          </div>
          <div className="rounded-[var(--bubo-radius-lg)] bg-[rgb(var(--bubo-color-surface-muted))] p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]">
                {coach?.connected ? <Brain size={21} aria-hidden="true" /> : <WifiOff size={21} aria-hidden="true" />}
              </span>
              <div>
                <strong className="block">{coach?.connected ? 'IA conectada' : 'Modo local ativo'}</strong>
                <span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">
                  {coach?.provider || 'local'} · {coach?.model || 'avaliador Bubo'}
                </span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
              {coach?.connected
                ? 'As avaliações usam um provedor configurado exclusivamente no servidor.'
                : 'O aplicativo continua funcionando sem enviar seu texto a um provedor externo.'}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <CognitiveProfileCard />

        <Card>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]">
              <RefreshCw size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Retenção</p>
              <h2 className="mt-1 text-xl font-black">Revisões sugeridas</h2>
            </div>
          </div>

          {isLoadingProfile && !profile ? (
            <div className="mt-6 space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full" rounded="lg" />
              ))}
            </div>
          ) : books.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon={BookOpen}
                title="Nenhuma memória para revisar"
                description="Conclua uma Deep Review aprovada para receber perguntas de retenção por livro."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {books.slice(0, 5).map((book) => (
                <article key={String(book.bookId || book.title)} className="rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="block">{book.title}</strong>
                      <span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">
                        {book.reviews} review{book.reviews === 1 ? '' : 's'} · média {book.averageDepth}%
                      </span>
                    </div>
                    <span className="shrink-0 text-xs text-[rgb(var(--bubo-color-text-muted))]">
                      {formatRelativeTime(book.lastReviewAt)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
                    {book.retentionPrompt || 'Explique a ideia central da última leitura e cite uma evidência que sustenta sua interpretação.'}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
