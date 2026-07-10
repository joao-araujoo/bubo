import React from 'react';
import { ArrowRight, Brain, Gem, Plus, Sparkles, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import BookCover from '../components/books/BookCover';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ProgressBar from '../components/ui/ProgressBar';
import { useAuthStore } from '../stores/useAuthStore';

const readingBooks = [
  { title: 'Duna', author: 'Frank Herbert', page: 138, pages: 412 },
  { title: 'O Alquimista', author: 'Paulo Coelho', page: 76, pages: 208 },
];

const challenges = [
  { title: 'Meta anual', description: 'Concluir livros mantendo histórico reflexivo.', value: 2, max: 20, xp: 350, Icon: Target },
  { title: 'Semana profunda', description: 'Fazer 3 Deep Reviews em 7 dias.', value: 1, max: 3, xp: 180, Icon: Brain },
  { title: 'Síntese premium', description: 'Alcançar 5 reviews com nota 85+.', value: 1, max: 5, xp: 240, Icon: Gem },
];

function GuestHero() {
  return (
    <Card className="mx-auto max-w-4xl overflow-hidden" padding="lg">
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--bubo-color-primary)/0.22)] bg-[rgb(var(--bubo-color-primary)/0.08)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.16em] text-[rgb(var(--bubo-color-primary))]">
            <span className="h-2 w-2 rounded-full bg-[rgb(var(--bubo-color-success))]" />
            Bubo 2.0
          </span>
          <h1 className="mt-6 max-w-xl text-4xl font-black leading-[1.06] tracking-[-0.04em] sm:text-5xl">
            Leia menos no automático. <span className="text-[rgb(var(--bubo-color-primary))]">Retenha mais.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[rgb(var(--bubo-color-text-muted))] sm:text-lg">
            O Bubo une acervo, Deep Reviews, inteligência artificial e comunidade para transformar progresso de leitura em memória validada.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link to="/auth"><Button className="w-full sm:w-auto" leftIcon={<Sparkles size={18} />}>Começar agora</Button></Link>
            <Link to="/feed"><Button className="w-full sm:w-auto" variant="secondary" rightIcon={<ArrowRight size={17} />}>Ver comunidade</Button></Link>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-sm rounded-[1.75rem] bg-[rgb(var(--bubo-color-primary)/0.08)] p-8">
          <div className="mx-auto flex aspect-square max-w-[15rem] items-center justify-center rounded-full border border-[rgb(var(--bubo-color-primary)/0.18)] bg-[rgb(var(--bubo-color-surface))] text-[7rem] shadow-[var(--bubo-shadow-lg)]" aria-label="Mascote Bubo">🦉</div>
          <div className="absolute bottom-5 right-4 rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] px-5 py-3 shadow-[var(--bubo-shadow-md)]">
            <span className="block text-2xl font-black text-[rgb(var(--bubo-color-primary))]">86%</span>
            <span className="text-xs text-[rgb(var(--bubo-color-text-muted))]">profundidade</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function HomePage() {
  const { token, user } = useAuthStore();

  if (!token) return <GuestHero />;

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Agora</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.025em] sm:text-3xl">Lendo no momento</h1>
          <p className="mt-2 text-sm text-[rgb(var(--bubo-color-text-muted))]">Continue de onde parou e registre o que realmente ficou.</p>
        </div>
        <Button variant="secondary" leftIcon={<Plus size={17} />}>Adicionar livro</Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {readingBooks.map((book) => (
          <Card key={book.title} interactive className="grid grid-cols-[6.5rem_1fr] gap-4">
            <BookCover title={book.title} author={book.author} />
            <div className="flex min-w-0 flex-col">
              <div>
                <h2 className="truncate text-lg font-extrabold">{book.title}</h2>
                <p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{book.author}</p>
              </div>
              <ProgressBar className="mt-5" value={book.page} max={book.pages} label={`Página ${book.page}`} showValue />
              <Button className="mt-auto w-full" variant="secondary" size="sm">Fazer review</Button>
            </div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.78fr]">
        <Card>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Desafios</p>
              <h2 className="mt-1 text-xl font-black">Missões de retenção</h2>
            </div>
            <Link to="/achievements" className="text-sm font-bold text-[rgb(var(--bubo-color-primary))] hover:underline">Ver todas</Link>
          </div>
          <div className="space-y-3">
            {challenges.map(({ Icon, description, max, title, value, xp }) => (
              <div key={title} className="rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] p-4">
                <div className="flex gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><Icon size={20} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="font-extrabold">{title}</h3><p className="mt-1 text-sm leading-5 text-[rgb(var(--bubo-color-text-muted))]">{description}</p></div>
                      <span className="shrink-0 rounded-full border border-[rgb(var(--bubo-color-primary)/0.22)] bg-[rgb(var(--bubo-color-primary)/0.08)] px-2.5 py-1 text-xs font-extrabold text-[rgb(var(--bubo-color-primary))]">+{xp} XP</span>
                    </div>
                    <ProgressBar className="mt-4" value={value} max={max} showValue />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Rede social</p><h2 className="mt-1 text-xl font-black">Insight em alta</h2></div>
            <Link to="/feed" className="text-sm font-bold text-[rgb(var(--bubo-color-primary))] hover:underline">Abrir feed</Link>
          </div>
          <div className="mt-5 flex items-center gap-3"><Avatar name={user?.username || 'Leitor Ávido'} /><div><strong className="block">{user?.username || 'Leitor Ávido'}</strong><span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">há 6 dias</span></div></div>
          <p className="mt-5 leading-7 text-[rgb(var(--bubo-color-text-muted))]">Registrei uma tentativa de Deep Review em <strong className="text-[rgb(var(--bubo-color-text))]">Noites Brancas</strong>. Preciso aprofundar as relações entre as ideias do trecho.</p>
          <div className="mt-5 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4">
            <span className="text-xs font-extrabold uppercase tracking-[0.15em] text-[rgb(var(--bubo-color-primary))]">Insight</span>
            <p className="mt-2 font-bold leading-6">A idealização do narrador revela mais sobre sua solidão do que sobre a mulher encontrada.</p>
          </div>
        </Card>
      </section>
    </div>
  );
}
