import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import BookCover from '../components/books/BookCover';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';

const catalog = [
  { id: 1, title: 'Dom Casmurro', author: 'Machado de Assis', pages: null },
  { id: 2, title: 'Memórias Póstumas de Brás Cubas', author: 'Machado de Assis', pages: 176 },
  { id: 3, title: 'Duna', author: 'Frank Herbert', pages: 412 },
  { id: 4, title: 'O Alquimista', author: 'Paulo Coelho', pages: 208 },
  { id: 5, title: '1984', author: 'George Orwell', pages: 328 },
  { id: 6, title: 'Noites Brancas', author: 'Fiódor Dostoiévski', pages: 96 },
];

export default function DiscoverPage() {
  const [input, setInput] = useState('Dom Casmurro');
  const [query, setQuery] = useState('Dom Casmurro');

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return catalog.filter((book) => `${book.title} ${book.author}`.toLowerCase().includes(normalized));
  }, [query]);

  const search = (event) => {
    event.preventDefault();
    setQuery(input);
  };

  return (
    <div className="space-y-6">
      <Card>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={search}>
          <label className="relative flex-1">
            <span className="sr-only">Buscar livros</span>
            <Search size={19} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--bubo-color-text-muted))]" />
            <input value={input} onChange={(event) => setInput(event.target.value)} className="min-h-12 w-full rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] pl-10 pr-3 outline-none focus:border-[rgb(var(--bubo-color-primary))]" placeholder="Título, autor ou ISBN" />
          </label>
          <Button type="submit" className="sm:min-w-28">Buscar</Button>
        </form>
      </Card>

      <section>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Resultado</p>
        <h1 className="mt-1 text-2xl font-black">{results.length} livros encontrados</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Quando faltarem capa, autor ou número de páginas, o Bubo usará um fallback editável em vez de exibir conteúdo quebrado.</p>
      </section>

      {results.length === 0 ? (
        <EmptyState title="Nenhum resultado" description="Tente buscar por outro título, autor ou ISBN." />
      ) : (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((book) => (
            <Card key={book.id} padding="sm" interactive className="flex flex-col">
              <BookCover title={book.title} author={book.author} />
              <h2 className="mt-3 line-clamp-2 font-extrabold leading-5">{book.title}</h2>
              <p className="mt-1 line-clamp-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{book.author || 'Autor não informado'}</p>
              <p className="mt-3 text-xs leading-5 text-[rgb(var(--bubo-color-text-muted))]">{book.pages ? `${book.pages} páginas` : 'Páginas não informadas · editável'}</p>
              <Button className="mt-auto w-full pt-0" size="sm">Adicionar</Button>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
