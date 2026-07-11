import React, { useEffect } from 'react';
import { ArrowRight, BookOpen, Brain, Gem, Plus, Sparkles, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import BookCover from '../components/books/BookCover';
import BuboMascot from '../components/owl/BuboMascot';
import ReaderRecommendationsSection from '../components/social/ReaderRecommendationsSection';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import { CardSkeleton } from '../components/ui/Skeleton';
import { useAuthStore } from '../stores/useAuthStore';
import { useDashboardStore } from '../stores/useDashboardStore';
import { useLibraryStore } from '../stores/useLibraryStore';
import { useSocialStore } from '../stores/useSocialStore';
import { formatRelativeTime, getActivityLabel } from '../utils/formatters';

const challengeIcons = {
  annual_goal: Target,
  deep_week: Brain,
  premium_synthesis: Gem,
};

function GuestHero() {
  return (
    <Card className="mx-auto max-w-4xl overflow-hidden" padding="lg">
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--bubo-color-primary)/0.22)] bg-[rgb(var(--bubo-color-primary)/0.08)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-[rgb(var(--bubo-color-primary))]">
            <span className="h-2 w-2 rounded-full bg-[rgb(var(--bubo-color-success))]" />
            Bubo 3.0
          </span>
          <h1 className="mt-6 max-w-xl text-4xl font-black leading-[1.06] tracking-[-0.04em] sm:text-5xl">
            Leia menos no automático. <span className="text-[rgb(var(--bubo-color-primary))]">Retenha mais.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[rgb(var(--bubo-color-text-muted))] sm:text-lg">
            O Bubo une acervo, Deep Reviews, inteligência artificial e comunidade para transformar progresso de leitura em memória validada.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button as={Link} to="/auth" className="w-full sm:w-auto" leftIcon={<Sparkles size={18} aria-hidden="true" />}>Começar agora</Button>
            <Button as={Link} to="/auth" className="w-full sm:w-auto" variant="secondary" rightIcon={<ArrowRight size={17} aria-hidden="true" />}>Conhecer a comunidade</Button>
          </div>
        </div>

        <div className="relative mx-auto flex min-h-[21rem] w-full max-w-sm items-center justify-center rounded-[1.75rem] bg-[rgb(var(--bubo-color-primary)/0.08)] p-8">
          <div className="rounded-full border border-[rgb(var(--bubo-color-primary)/0.18)] bg-[rgb(var(--bubo-color-surface))] p-6 shadow-[var(--bubo-shadow-lg)]">
            <BuboMascot state="approved" size={210} />
          </div>
          <div className="absolute bottom-5 right-4 rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] px-5 py-3 shadow-[var(--bubo-shadow-md)]">
            <span className="block text-2xl font-black text-[rgb(var(--bubo-color-primary))]">86</span>
            <span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">profundidade</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function HomePage() {
  const { token, user } = useAuthStore();
  const { books, fetchLibrary, isLoading: libraryLoading } = useLibraryStore();
  const { dashboard, fetchDashboard, isLoading: dashboardLoading } = useDashboardStore();
  const {
    activities,
    fetchFeed,
    fetchReaderRecommendations,
    isLoading: feedLoading,
  } = useSocialStore();

  useEffect(() => {
    if (!token) return;
    fetchLibrary().catch(() => {});
    fetchDashboard().catch(() => {});
    fetchFeed().catch(() => {});
    fetchReaderRecommendations().catch(() => {});
  }, [fetchDashboard, fetchFeed, fetchLibrary, fetchReaderRecommendations, token]);

  if (!token) return <GuestHero />;

  const readingBooks = books.filter((item) => item.status === 'reading');
  const challenges = dashboard?.challenges || [];
  const featuredActivity = activities[0];
  const isLoading = libraryLoading || dashboardLoading;

  const openReview = (userBook) => {
    window.dispatchEvent(new CustomEvent('bubo:open-deep-review', { detail: { userBook } }));
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Agora</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.025em] sm:text-3xl">Lendo no momento</h1>
          <p className="mt-2 text-sm text-[rgb(var(--bubo-color-text-muted))]">Continue de onde parou e registre o que realmente ficou.</p>
        </div>
        <Button as={Link} to="/discover" variant="secondary" leftIcon={<Plus size={17} aria-hidden="true" />}>Adicionar livro</Button>
      </section>

      {isLoading ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
        </section>
      ) : readingBooks.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {readingBooks.map((userBook) => {
            const book = userBook.bookId || {};
            const currentPage = Number(userBook.currentPage) || 0;
            const totalPages = Number(book.totalPages) || Math.max(currentPage, 1);
            return (
              <Card key={userBook._id} interactive className="grid grid-cols-[6.5rem_1fr] gap-4">
                <BookCover title={book.title} author={book.author} src={book.coverImage} />
                <div className="flex min-w-0 flex-col">
                  <div>
                    <h2 className="truncate text-lg font-extrabold">{book.title || 'Livro sem título'}</h2>
                    <p className="mt-1 truncate text-sm text-[rgb(var(--bubo-color-text-muted))]">{book.author || 'Autor não informado'}</p>
                  </div>
                  <ProgressBar className="mt-5" value={currentPage} max={totalPages} label={`Página ${currentPage}`} showValue />
                  <Button className="mt-auto w-full" variant="secondary" size="sm" onClick={() => openReview(userBook)}>Fazer review</Button>
                </div>
              </Card>
            );
          })}
        </section>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Nenhuma leitura em andamento"
          description="Adicione um livro e marque como “Lendo” para acompanhar o progresso aqui."
          actionLabel="Descobrir livros"
          onAction={() => window.location.assign('/discover')}
        />
      )}

      <section className="grid gap-6 xl:grid-cols-[1fr_0.78fr]">
        <Card>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Desafios</p>
              <h2 className="mt-1 text-xl font-black">Missões de retenção</h2>
            </div>
            <Link to="/achievements" className="text-sm font-bold text-[rgb(var(--bubo-color-primary))] hover:underline">Ver todas</Link>
          </div>

          {dashboardLoading ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : (
            <div className="space-y-3">
              {challenges.map((challenge) => {
                const Icon = challengeIcons[challenge.id] || Target;
                return (
                  <div key={challenge.id} className="rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] p-4">
                    <div className="flex gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><Icon size={20} aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-extrabold">{challenge.title}</h3>
                            <p className="mt-1 text-sm leading-5 text-[rgb(var(--bubo-color-text-muted))]">{challenge.description}</p>
                          </div>
                          <span className="shrink-0 rounded-full border border-[rgb(var(--bubo-color-primary)/0.22)] bg-[rgb(var(--bubo-color-primary)/0.08)] px-2.5 py-1 text-xs font-extrabold text-[rgb(var(--bubo-color-primary))]">+{challenge.xp} XP</span>
                        </div>
                        <ProgressBar className="mt-4" value={challenge.current} max={challenge.target} showValue />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Rede social</p>
              <h2 className="mt-1 text-xl font-black">Insight em alta</h2>
            </div>
            <Link to="/feed" className="text-sm font-bold text-[rgb(var(--bubo-color-primary))] hover:underline">Abrir feed</Link>
          </div>

          {feedLoading ? (
            <CardSkeleton className="mt-5" />
          ) : featuredActivity ? (
            <>
              <div className="mt-5 flex items-center gap-3">
                <Avatar name={featuredActivity.username || user?.username || 'Leitor Bubo'} src={featuredActivity.avatar} />
                <div>
                  <strong className="block">{featuredActivity.username || user?.username || 'Leitor Bubo'}</strong>
                  <span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">{getActivityLabel(featuredActivity.type, featuredActivity.postType)} · {formatRelativeTime(featuredActivity.createdAt)}</span>
                </div>
              </div>
              <p className="mt-5 leading-7 text-[rgb(var(--bubo-color-text-muted))]">{featuredActivity.message}</p>
              {featuredActivity.insight && (
                <div className="mt-5 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4">
                  <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-[rgb(var(--bubo-color-primary))]">Insight</span>
                  <p className="mt-2 font-bold leading-6">{featuredActivity.insight}</p>
                </div>
              )}
            </>
          ) : (
            <EmptyState className="mt-5" title="O feed está começando" description="Compartilhe o primeiro insight da comunidade Bubo." />
          )}
        </Card>
      </section>

      <ReaderRecommendationsSection />
    </div>
  );
}
