import React, { useMemo, useState } from 'react';
import { BookOpen, Grid2X2, Plus, Search } from 'lucide-react';
import BookCover from '../components/books/BookCover';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';

const books = [
  { id: 1, title: 'Duna', author: 'Frank Herbert', status: 'reading', page: 138, pages: 412 },
  { id: 2, title: 'O Alquimista', author: 'Paulo Coelho', status: 'reading', page: 76, pages: 208 },
  { id: 3, title: '1984', author: 'George Orwell', status: 'read', page: 328, pages: 328 },
  { id: 4, title: 'Dom Casmurro', author: 'Machado de Assis', status: 'want', page: 0, pages: 256 },
  { id: 5, title: 'Noites Brancas', author: 'Fiódor Dostoiévski', status: 'read', page: 96, pages: 96 },
  { id: 6, title: 'O Hobbit', author: 'J. R. R. Tolkien', status: 'want', page: 0, pages: 310 },
];

const filters = [
  { key: 'all', label: 'Todos' },
  { key: 'reading', label: 'Lendo' },
  { key: 'read', label: 'Lidos' },
  { key: 'want', label: 'Quero ler' },
];

export default function LibraryPage() {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const visibleBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return books.filter((book) => {
      const matchesStatus = filter === 'all' || book.status === filter;
      const matchesSearch = !normalized || `${book.title} ${book.author}`.toLowerCase().includes(normalized);
      return matchesStatus && matchesSearch;
    });
  }, [filter, query]);

  const pagesRegistered = books.reduce((total, book) => total + book.page, 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Paginômetro</p>
          <div className="mt-3 flex items-end gap-2"><strong className="text-4xl font-black text-[rgb(var(--bubo-color-primary))]">{pagesRegistered}</strong><span className="pb-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">páginas registradas</span></div>
          <div className="mt-5 border-t border-[rgb(var(--bubo-color-border))] pt-4 text-sm text-[rgb(var(--bubo-color-text-muted))]">Média por livro <strong className="float-right text-[rgb(var(--bubo-color-text))]">{Math.round(pagesRegistered / books.length)}</strong></div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Seu acervo</p><h1 className="mt-1 text-2xl font-black">Biblioteca pessoal</h1></div>
            <Button leftIcon={<Plus size={17} />}>Adicionar livro</Button>
          </div>
          <div className="relative mt-5">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--bubo-color-text-muted))]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquise no seu acervo" className="min-h-11 w-full rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] pl-10 pr-3 text-sm outline-none focus:border-[rgb(var(--bubo-color-primary))]" />
          </div>
        </Card>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar acervo">
        {filters.map((item) => {
          const count = item.key === 'all' ? books.length : books.filter((book) => book.status === item.key).length;
          const active = filter === item.key;
          return <button key={item.key} type="button" role="tab" aria-selected={active} onClick={() => setFilter(item.key)} className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${active ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary))] text-white' : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))] hover:text-[rgb(var(--bubo-color-text))]'}`}>{item.label}<span className="text-xs opacity-75">{count}</span></button>;
        })}
      </div>

      {visibleBooks.length === 0 ? (
        <EmptyState icon={BookOpen} title="Nenhum livro encontrado" description="Altere o filtro ou a busca para encontrar outro item do seu acervo." />
      ) : (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleBooks.map((book) => (
            <Card key={book.id} padding="sm" interactive className="flex flex-col">
              <BookCover title={book.title} author={book.author} />
              <h2 className="mt-3 line-clamp-2 font-extrabold leading-5">{book.title}</h2>
              <p className="mt-1 line-clamp-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{book.author}</p>
              {book.status === 'reading' ? <ProgressBar className="mt-4" value={book.page} max={book.pages} /> : <div className="mt-4 h-2" />}
              <p className="mt-2 text-xs text-[rgb(var(--bubo-color-text-muted))]">{book.status === 'reading' ? `Página ${book.page} / ${book.pages}` : book.status === 'read' ? 'Leitura concluída' : 'Na lista de desejos'}</p>
              <div className="mt-auto grid grid-cols-2 gap-2 pt-4"><Button size="sm" variant="secondary">Review</Button><Button size="sm" variant="ghost">Editar</Button></div>
            </Card>
          ))}
        </section>
      )}

      <div className="flex items-center gap-2 text-sm text-[rgb(var(--bubo-color-text-muted))]"><Grid2X2 size={16} /><span>{visibleBooks.length} itens exibidos</span></div>
    </div>
  );
}
