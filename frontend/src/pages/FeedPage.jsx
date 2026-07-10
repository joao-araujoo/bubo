import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, Heart, MessageCircle, Send, UserCheck, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import CommentThread from '../components/social/CommentThread';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Skeleton from '../components/ui/Skeleton';
import Textarea from '../components/ui/Textarea';
import { useAuthStore } from '../stores/useAuthStore';
import { useSocialStore } from '../stores/useSocialStore';
import { formatRelativeTime, getActivityLabel } from '../utils/formatters';

const contentFilters = [
  { key: 'all', label: 'Tudo' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'posts', label: 'Posts' },
  { key: 'challenges', label: 'Desafios' },
];

const feedScopes = [
  { key: 'all', label: 'Comunidade' },
  { key: 'following', label: 'Seguindo' },
];

export default function FeedPage() {
  const { user } = useAuthStore();
  const {
    activities,
    createPost,
    error,
    fetchFeed,
    isLoading,
    isPublishing,
    scope,
    toggleFollow,
    toggleLike,
    toggleSave
  } = useSocialStore();
  const [postType, setPostType] = useState('free');
  const [text, setText] = useState('');
  const [insight, setInsight] = useState('');
  const [filter, setFilter] = useState('all');
  const [openComments, setOpenComments] = useState(() => new Set());

  useEffect(() => {
    fetchFeed().catch(() => {});
  }, [fetchFeed]);

  const visibleActivities = useMemo(() => activities.filter((activity) => {
    if (filter === 'all') return true;
    if (filter === 'reviews') return activity.type === 'review_approved' || activity.postType === 'review';
    if (filter === 'challenges') return activity.type === 'achievement_unlocked' || activity.postType === 'challenge';
    if (filter === 'posts') return activity.type === 'post' && activity.postType === 'free';
    return true;
  }), [activities, filter]);

  const publish = async (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;

    try {
      await createPost({
        message,
        insight: postType === 'review' ? insight.trim() : '',
        postType
      });
      setText('');
      setInsight('');
      toast.success('Sua ideia foi publicada.');
    } catch (publishError) {
      toast.error(publishError.message);
    }
  };

  const changeScope = async (nextScope) => {
    if (nextScope === scope || isLoading) return;
    try {
      await fetchFeed(nextScope);
    } catch (scopeError) {
      toast.error(scopeError.message);
    }
  };

  const toggleComments = (activityId) => {
    setOpenComments((current) => {
      const next = new Set(current);
      if (next.has(activityId)) next.delete(activityId);
      else next.add(activityId);
      return next;
    });
  };

  const runAction = async (action, fallbackMessage) => {
    try {
      await action();
    } catch (actionError) {
      toast.error(actionError.message || fallbackMessage);
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.78fr_1.22fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <div className="flex items-center gap-3">
            <Avatar name={user?.username || 'Leitor Bubo'} src={user?.avatar} />
            <div>
              <strong className="block">{user?.username || 'Leitor Bubo'}</strong>
              <span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">Compartilhe uma ideia</span>
            </div>
          </div>
          <form className="mt-5 space-y-4" onSubmit={publish}>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Qual ideia da sua leitura merece virar memória hoje?"
              rows={6}
              maxLength={2000}
              description={`${text.length}/2000 caracteres`}
            />
            <Select value={postType} onChange={(event) => setPostType(event.target.value)} aria-label="Tipo de publicação">
              <option value="free">Post livre</option>
              <option value="review">Insight de Deep Review</option>
              <option value="challenge">Progresso em desafio</option>
            </Select>
            {postType === 'review' && (
              <Input
                value={insight}
                onChange={(event) => setInsight(event.target.value)}
                placeholder="Insight principal em uma frase"
                maxLength={500}
              />
            )}
            <Button type="submit" className="w-full" leftIcon={<Send size={17} />} disabled={!text.trim()} isLoading={isPublishing}>
              Publicar
            </Button>
          </form>
        </Card>
      </aside>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Rede social</p>
          <h1 className="mt-1 text-2xl font-black">Ideias que merecem ficar</h1>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
            Conexões reais entre leitores, livros e memórias de longo prazo.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2" role="tablist" aria-label="Origem do feed">
            {feedScopes.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={scope === item.key}
                onClick={() => changeScope(item.key)}
                className={`min-h-10 rounded-full px-4 text-sm font-bold transition ${scope === item.key ? 'bg-[rgb(var(--bubo-color-primary))] text-white' : 'text-[rgb(var(--bubo-color-text-muted))] hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filtrar conteúdo">
            {contentFilters.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-bold transition ${filter === item.key ? 'border-[rgb(var(--bubo-color-primary))] text-[rgb(var(--bubo-color-primary))]' : 'border-transparent text-[rgb(var(--bubo-color-text-muted))] hover:text-[rgb(var(--bubo-color-text))]'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <div className="flex gap-3"><Skeleton className="h-11 w-11" rounded="full" /><div className="flex-1"><Skeleton className="h-5 w-1/3" /><Skeleton className="mt-2 h-4 w-1/2" /></div></div>
              <Skeleton className="mt-5 h-20 w-full" />
              <Skeleton className="mt-4 h-12 w-full" />
            </Card>
          ))
        ) : error && activities.length === 0 ? (
          <EmptyState title="Não foi possível carregar o feed" description={error} actionLabel="Tentar novamente" onAction={() => fetchFeed(scope).catch(() => {})} />
        ) : visibleActivities.length === 0 ? (
          <EmptyState
            title={scope === 'following' ? 'Seu feed de seguindo está vazio' : 'Nenhuma publicação neste filtro'}
            description={scope === 'following' ? 'Siga leitores interessantes na aba Comunidade para construir um feed mais pessoal.' : 'Novas ideias e Deep Reviews aparecerão aqui.'}
            actionLabel={scope === 'following' ? 'Ver comunidade' : undefined}
            onAction={scope === 'following' ? () => changeScope('all') : undefined}
          />
        ) : (
          visibleActivities.map((activity) => {
            const id = String(activity._id);
            const commentsAreOpen = openComments.has(id);
            const handle = `@${String(activity.username || 'leitor').toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

            return (
              <Card key={id} as="article">
                <div className="flex items-start gap-3">
                  <Avatar name={activity.username || 'Leitor Bubo'} src={activity.avatar} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <strong className="block">{activity.username || 'Leitor Bubo'}</strong>
                        <span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">{handle} · {formatRelativeTime(activity.createdAt)}</span>
                      </div>
                      {activity.isOwn ? (
                        <span className="rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-3 py-1 text-xs font-extrabold text-[rgb(var(--bubo-color-primary))]">Você</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => runAction(() => toggleFollow(activity.userId), 'Não foi possível seguir este leitor.')}
                          className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-xs font-extrabold transition ${activity.isFollowing ? 'border-[rgb(var(--bubo-color-primary)/0.3)] bg-[rgb(var(--bubo-color-primary)/0.08)] text-[rgb(var(--bubo-color-primary))]' : 'border-[rgb(var(--bubo-color-border))] text-[rgb(var(--bubo-color-text-muted))] hover:border-[rgb(var(--bubo-color-primary)/0.4)] hover:text-[rgb(var(--bubo-color-primary))]'}`}
                          aria-pressed={activity.isFollowing}
                        >
                          {activity.isFollowing ? <UserCheck size={15} aria-hidden="true" /> : <UserPlus size={15} aria-hidden="true" />}
                          {activity.isFollowing ? 'Seguindo' : 'Seguir'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {(activity.bookTitle || activity.cognitiveDepth > 0) && (
                  <div className="mt-5 flex items-center justify-between rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted))] p-3">
                    <div>
                      <strong className="block">{activity.bookTitle || 'Progresso de leitura'}</strong>
                      <span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">{getActivityLabel(activity.type, activity.postType)}</span>
                    </div>
                    {activity.cognitiveDepth > 0 && <span className="rounded-full border border-[rgb(var(--bubo-color-primary)/0.22)] bg-[rgb(var(--bubo-color-surface))] px-3 py-1 text-lg font-black text-[rgb(var(--bubo-color-primary))]">{activity.cognitiveDepth}%</span>}
                  </div>
                )}

                <p className="mt-5 whitespace-pre-line leading-7 text-[rgb(var(--bubo-color-text-muted))]">{activity.message}</p>
                {activity.insight && (
                  <div className="mt-5 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4">
                    <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-[rgb(var(--bubo-color-primary))]">Insight</span>
                    <p className="mt-2 font-bold leading-6">{activity.insight}</p>
                  </div>
                )}

                <div className="mt-5 flex items-center gap-1 border-t border-[rgb(var(--bubo-color-border))] pt-4">
                  <button
                    type="button"
                    onClick={() => runAction(() => toggleLike(id), 'Não foi possível curtir.')}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition hover:bg-[rgb(var(--bubo-color-surface-muted))] ${activity.isLiked ? 'text-[rgb(var(--bubo-color-danger))]' : 'text-[rgb(var(--bubo-color-text-muted))]'}`}
                    aria-pressed={activity.isLiked}
                    aria-label={activity.isLiked ? 'Remover curtida' : 'Curtir publicação'}
                  >
                    <Heart size={18} fill={activity.isLiked ? 'currentColor' : 'none'} aria-hidden="true" />
                    {activity.likesCount || 0}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleComments(id)}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition hover:bg-[rgb(var(--bubo-color-surface-muted))] ${commentsAreOpen ? 'text-[rgb(var(--bubo-color-primary))]' : 'text-[rgb(var(--bubo-color-text-muted))]'}`}
                    aria-expanded={commentsAreOpen}
                    aria-label="Abrir comentários"
                  >
                    <MessageCircle size={18} aria-hidden="true" />
                    {activity.commentsCount || 0}
                  </button>
                  <button
                    type="button"
                    onClick={() => runAction(() => toggleSave(id), 'Não foi possível salvar.')}
                    className={`ml-auto inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition hover:bg-[rgb(var(--bubo-color-surface-muted))] ${activity.isSaved ? 'text-[rgb(var(--bubo-color-primary))]' : 'text-[rgb(var(--bubo-color-text-muted))]'}`}
                    aria-pressed={activity.isSaved}
                    aria-label={activity.isSaved ? 'Remover dos salvos' : 'Salvar publicação'}
                  >
                    <Bookmark size={18} fill={activity.isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
                    {activity.isSaved ? 'Salvo' : 'Salvar'}
                  </button>
                </div>

                <CommentThread activityId={id} isOpen={commentsAreOpen} />
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
