import React, { useEffect, useMemo, useState } from 'react';
import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react';
import toast from 'react-hot-toast';
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

const filters = [
  { key: 'all', label: 'Tudo' },
  { key: 'reviews', label: 'Reviews' },
  { key: 'posts', label: 'Posts' },
  { key: 'challenges', label: 'Desafios' },
];

export default function FeedPage() {
  const { user } = useAuthStore();
  const { activities, createPost, error, fetchFeed, isLoading, isPublishing } = useSocialStore();
  const [postType, setPostType] = useState('free');
  const [text, setText] = useState('');
  const [insight, setInsight] = useState('');
  const [filter, setFilter] = useState('all');
  const [likedIds, setLikedIds] = useState(() => new Set());
  const [savedIds, setSavedIds] = useState(() => new Set());

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

  const toggleSetValue = (setter, id) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
            <Button type="submit" className="w-full" leftIcon={<Send size={17} />} disabled={!text.trim()} isLoading={isPublishing}>Publicar</Button>
          </form>
        </Card>
      </aside>

      <section className="space-y-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Rede social</p>
          <h1 className="mt-1 text-2xl font-black">Ideias que merecem ficar</h1>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar feed">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={filter === item.key}
              onClick={() => setFilter(item.key)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition ${filter === item.key ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary))] text-white' : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))] hover:text-[rgb(var(--bubo-color-text))]'}`}
            >
              {item.label}
            </button>
          ))}
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
          <EmptyState title="Não foi possível carregar o feed" description={error} actionLabel="Tentar novamente" onAction={() => fetchFeed().catch(() => {})} />
        ) : visibleActivities.length === 0 ? (
          <EmptyState title="Nenhuma publicação neste filtro" description="Novas ideias e Deep Reviews aparecerão aqui." />
        ) : (
          visibleActivities.map((activity) => {
            const id = String(activity._id);
            const liked = likedIds.has(id);
            const saved = savedIds.has(id);
            const handle = `@${String(activity.username || 'leitor').toLowerCase().replace(/[^a-z0-9]+/g, '')}`;
            return (
              <Card key={id} as="article">
                <div className="flex items-start gap-3">
                  <Avatar name={activity.username || 'Leitor Bubo'} src={activity.avatar} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <strong className="block">{activity.username || 'Leitor Bubo'}</strong>
                        <span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">{handle} · {formatRelativeTime(activity.createdAt)}</span>
                      </div>
                      {activity.isOwn && <span className="rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-3 py-1 text-xs font-extrabold text-[rgb(var(--bubo-color-primary))]">Você</span>}
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

                <div className="mt-5 flex items-center gap-2 border-t border-[rgb(var(--bubo-color-border))] pt-4">
                  <button type="button" onClick={() => toggleSetValue(setLikedIds, id)} className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition hover:bg-[rgb(var(--bubo-color-surface-muted))] ${liked ? 'text-[rgb(var(--bubo-color-danger))]' : 'text-[rgb(var(--bubo-color-text-muted))]'}`} aria-pressed={liked}><Heart size={18} fill={liked ? 'currentColor' : 'none'} /> {liked ? 1 : 0}</button>
                  <button type="button" onClick={() => toast('Comentários entram no próximo módulo social.')} className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[rgb(var(--bubo-color-text-muted))] transition hover:bg-[rgb(var(--bubo-color-surface-muted))]"><MessageCircle size={18} /> 0</button>
                  <button type="button" onClick={() => toggleSetValue(setSavedIds, id)} className={`ml-auto inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold transition hover:bg-[rgb(var(--bubo-color-surface-muted))] ${saved ? 'text-[rgb(var(--bubo-color-primary))]' : 'text-[rgb(var(--bubo-color-text-muted))]'}`} aria-pressed={saved}><Bookmark size={18} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Salvo' : 'Salvar'}</button>
                </div>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
