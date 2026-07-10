import React, { useState } from 'react';
import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Select from '../components/ui/Select';
import Textarea from '../components/ui/Textarea';
import { useAuthStore } from '../stores/useAuthStore';

const initialPosts = [
  {
    id: 1,
    user: 'Leitor Ávido',
    handle: '@leitoravido',
    time: '6 dias',
    type: 'Deep Review validada',
    book: 'Noites Brancas',
    score: 44,
    text: 'Registrei uma tentativa de Deep Review. Vou aprofundar com mais evidências do trecho e relações entre as ideias.',
    insight: 'A idealização do narrador revela mais sobre sua solidão do que sobre a mulher encontrada.',
  },
  {
    id: 2,
    user: 'Clara Mendes',
    handle: '@claram',
    time: '2 horas',
    type: 'Insight livre',
    book: 'Duna',
    score: 91,
    text: 'A ecologia de Arrakis não é cenário: ela organiza poder, religião e sobrevivência em uma única estrutura narrativa.',
    insight: 'O ambiente também é personagem quando condiciona todas as escolhas possíveis.',
  },
];

export default function FeedPage() {
  const { user } = useAuthStore();
  const [postType, setPostType] = useState('free');
  const [text, setText] = useState('');
  const [posts, setPosts] = useState(initialPosts);

  const publish = (event) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setPosts((current) => [{ id: Date.now(), user: user?.username || 'Leitor Ávido', handle: '@você', time: 'agora', type: postType === 'review' ? 'Deep Review' : 'Post livre', book: null, score: null, text: trimmed, insight: null }, ...current]);
    setText('');
  };

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.78fr_1.22fr]">
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Card>
          <div className="flex items-center gap-3"><Avatar name={user?.username || 'Leitor Ávido'} /><div><strong className="block">{user?.username || 'Leitor Ávido'}</strong><span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">Compartilhe uma ideia</span></div></div>
          <form className="mt-5 space-y-4" onSubmit={publish}>
            <Textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Qual ideia da sua leitura merece virar memória hoje?" rows={6} />
            <Select value={postType} onChange={(event) => setPostType(event.target.value)} aria-label="Tipo de publicação"><option value="free">Post livre</option><option value="review">Insight de Deep Review</option><option value="challenge">Progresso em desafio</option></Select>
            <Button type="submit" className="w-full" leftIcon={<Send size={17} />} disabled={!text.trim()}>Publicar</Button>
          </form>
        </Card>
      </aside>

      <section className="space-y-4">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Rede social</p><h1 className="mt-1 text-2xl font-black">Ideias que merecem ficar</h1></div>
        <div className="flex gap-2 overflow-x-auto pb-1">{['Tudo', 'Seguindo', 'Reviews', 'Desafios'].map((filter, index) => <button key={filter} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold ${index === 0 ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary))] text-white' : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))]'}`}>{filter}</button>)}</div>

        {posts.map((post) => (
          <Card key={post.id} as="article">
            <div className="flex items-start gap-3"><Avatar name={post.user} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong className="block">{post.user}</strong><span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">{post.handle} · {post.time}</span></div>{post.handle === '@você' && <span className="rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-3 py-1 text-xs font-extrabold text-[rgb(var(--bubo-color-primary))]">Você</span>}</div></div></div>
            {(post.book || post.score) && <div className="mt-5 flex items-center justify-between rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted))] p-3"><div><strong className="block">{post.book}</strong><span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">{post.type}</span></div>{post.score && <span className="rounded-full border border-[rgb(var(--bubo-color-primary)/0.22)] bg-[rgb(var(--bubo-color-surface))] px-3 py-1 text-lg font-black text-[rgb(var(--bubo-color-primary))]">{post.score}%</span>}</div>}
            <p className="mt-5 leading-7 text-[rgb(var(--bubo-color-text-muted))]">{post.text}</p>
            {post.insight && <div className="mt-5 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4"><span className="text-xs font-extrabold uppercase tracking-[0.15em] text-[rgb(var(--bubo-color-primary))]">Insight</span><p className="mt-2 font-bold leading-6">{post.insight}</p></div>}
            <div className="mt-5 flex items-center gap-2 border-t border-[rgb(var(--bubo-color-border))] pt-4"><button className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[rgb(var(--bubo-color-text-muted))] hover:bg-[rgb(var(--bubo-color-surface-muted))]"><Heart size={18} /> 0</button><button className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[rgb(var(--bubo-color-text-muted))] hover:bg-[rgb(var(--bubo-color-surface-muted))]"><MessageCircle size={18} /> 0</button><button className="ml-auto inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[rgb(var(--bubo-color-text-muted))] hover:bg-[rgb(var(--bubo-color-surface-muted))]"><Bookmark size={18} /> Salvar</button></div>
          </Card>
        ))}
      </section>
    </div>
  );
}
