import React, { useEffect } from 'react';
import { ArrowRight, BookOpen, Brain, RefreshCw, Sparkles, WifiOff } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import CognitiveProfileCard from '../components/deepReview/CognitiveProfileCard';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { useCoachStore } from '../stores/useCoachStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { formatRelativeTime } from '../utils/formatters';

const providerLabels = {
  openai: 'OpenAI',
  gemini: 'Google Gemini',
};

export default function CoachPage() {
  const navigate = useNavigate();
  const { error, fetchProfile, isLoadingProfile, profile } = useCoachStore();
  const { books: libraryBooks, fetchLibrary } = useLibraryStore();

  useEffect(() => {
    Promise.allSettled([fetchProfile(), fetchLibrary()]);
  }, [fetchLibrary, fetchProfile]);

  const books = profile?.books || [];
  const coach = profile?.coach;
  const connected = Boolean(coach?.connected);

  const openDeepReview = () => {
    window.dispatchEvent(new CustomEvent('bubo:open-deep-review'));
  };

  const findReading = (catalogBookId) => libraryBooks.find((item) => (
    String(item.bookId?._id || item.bookId) === String(catalogBookId)
  ));

  if (error && !profile && !isLoadingProfile) {
    return (
      <EmptyState
        icon={Brain}
        title="Não foi possível carregar o Reading Coach"
        description={error}
        actionLabel="Tentar novamente"
        onAction={() => fetchProfile({ force: true }).catch(() => {})}
      />
    );
  }

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
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {connected ? (
                <Button onClick={openDeepReview} leftIcon={<Sparkles size={17} aria-hidden="true" />}>Fazer Deep Review</Button>
              ) : (
                <Button as={Link} to="/library" variant="secondary" leftIcon={<BookOpen size={17} aria-hidden="true" />}>Abrir acervo</Button>
              )}
              <Button as={Link} to="/library" variant="ghost" rightIcon={<ArrowRight size={17} aria-hidden="true" />}>Ver minhas leituras</Button>
            </div>
          </div>

          {isLoadingProfile && !profile ? (
            <div className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] p-5">
              <Skeleton className="h-11 w-11" rounded="lg" />
              <Skeleton className="mt-4 h-5 w-1/2" />
              <Skeleton className="mt-2 h-4 w-3/4" />
              <Skeleton className="mt-5 h-14 w-full" />
            </div>
          ) : (
            <div className={`rounded-[var(--bubo-radius-lg)] border p-5 ${connected ? 'border-[rgb(var(--bubo-color-success)/0.28)] bg-[rgb(var(--bubo-color-success)/0.06)]' : 'border-[rgb(var(--bubo-color-warning)/0.32)] bg-[rgb(var(--bubo-color-warning)/0.07)]'}`}>
              <div className="flex items-center gap-3">
                <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${connected ? 'bg-[rgb(var(--bubo-color-success)/0.13)] text-[rgb(var(--bubo-color-success))]' : 'bg-[rgb(var(--bubo-color-warning)/0.13)] text-[rgb(var(--bubo-color-warning))]'}`}>
                  {connected ? <Brain size={21} aria-hidden="true" /> : <WifiOff size={21} aria-hidden="true" />}
                </span>
                <div>
                  <strong className="block">{connected ? 'IA conectada' : 'IA não configurada'}</strong>
                  <span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">
                    {connected
                      ? `${providerLabels[coach?.provider] || coach?.provider || 'Provedor'} · ${coach?.model || 'modelo configurado'}`
                      : 'Nenhuma avaliação simulada será criada'}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
                {connected
                  ? 'Suas Deep Reviews são avaliadas pelo provedor configurado exclusivamente no servidor.'
                  : 'O acervo e a rede social continuam disponíveis, mas a Deep Review só será avaliada depois que OpenAI ou Gemini forem configurados no servidor.'}
              </p>
            </div>
          )}
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
                actionLabel="Abrir acervo"
                onAction={() => navigate('/library')}
              />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {books.slice(0, 5).map((book) => {
                const reading = findReading(book.bookId);
                return (
                  <article key={String(book.bookId || book.title)} className="rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <strong className="block">{book.title}</strong>
                        <span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">
                          {book.reviews} review{book.reviews === 1 ? '' : 's'} · média {book.averageDepth}%
                        </span>
                      </div>
                      <span className="shrink-0 text-xs text-[rgb(var(--bubo-color-text-muted))]">{formatRelativeTime(book.lastReviewAt)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
                      {book.retentionPrompt || 'Explique a ideia central da última leitura e cite uma evidência que sustenta sua interpretação.'}
                    </p>
                    {reading ? (
                      <Button as={Link} to={`/library/${reading._id}`} size="sm" variant="secondary" className="mt-4 w-full" rightIcon={<ArrowRight size={16} aria-hidden="true" />}>
                        Abrir leitura
                      </Button>
                    ) : (
                      <Button as={Link} to="/library" size="sm" variant="ghost" className="mt-4 w-full" rightIcon={<ArrowRight size={16} aria-hidden="true" />}>
                        Localizar no acervo
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
