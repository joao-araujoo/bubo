import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Grid2X2, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import BookCover from '../components/books/BookCover';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import Select from '../components/ui/Select';
import Skeleton from '../components/ui/Skeleton';
import { useLibraryStore } from '../stores/useLibraryStore';
import { formatNumber, getBookStatusLabel } from '../utils/formatters';

const filters = [
  { key: 'all', label: 'Todos' },
  { key: 'reading', label: 'Lendo' },
  { key: 'read', label: 'Lidos' },
  { key: 'to-read', label: 'Quero ler' },
  { key: 'abandoned', label: 'Abandonados' },
];

export default function LibraryPage() {
  const { books, error, fetchLibrary, isLoading, isUpdating, updateBookStatus } = useLibraryStore();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetchLibrary().catch(() => {});
  }, [fetchLibrary]);

  const visibleBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return books.filter((userBook) => {
      const book = userBook.bookId || {};
      const matchesStatus = filter === 'all' || userBook.status === filter;
      const matchesSearch = !normalized || `${book.title || ''} ${book.author || ''}`.toLowerCase().includes(normalized);
      return matchesStatus && matchesSearch;
    });
  }, [books, filter, query]);

  const pagesRegistered = books.reduce((total, userBook) => total + (Number(userBook.currentPage) || 0), 0);
  const averagePages = books.length > 0 ? Math.round(pagesRegistered / books.length) : 0;

  const openReview = (userBook) => {
    window.dispatchEvent(new CustomEvent('bubo:open-deep-review', { detail: { userBook } }));
  };

  const changeStatus = async (userBook, status) => {
    const totalPages = Number(userBook.bookId?.totalPages) || 0;
    const currentPage = status === 'read' && totalPages > 0 ? totalPages : userBook.currentPage;
    try {
      await updateBookStatus(userBook._id, { status, currentPage });
      toast.success(`Livro marcado como “${getBookStatusLabel(status)}”.`);
    } catch (statusError) {
      toast.error(statusError.message);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Paginômetro</p>
          <div className="mt-3 flex items-end gap-2">
            <strong className="text-4xl font-black text-[rgb(var(--bubo-color-primary))]">{formatNumber(pagesRegistered)}</strong>
            <span className="pb-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">páginas registradas</span>
          </div>
          <div className="mt-5 border-t border-[rgb(var(--bubo-color-border))] pt-4 text-sm text-[rgb(var(--bubo-color-text-muted))]">
            Média por livro <strong className="float-right text-[rgb(var(--bubo-color-text))]">{formatNumber(averagePages)}</strong>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Seu acervo</p>
              <h1 className="mt-1 text-2xl font-black">Biblioteca pessoal</h1>
            </div>
            <Button as={Link} to="/discover" leftIcon={<Plus size={17} />}>Adicionar livro</Button>
          </div>
          <div className="relative mt-5">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--bubo-color-text-muted))]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquise no seu acervo"
              className="min-h-11 w-full rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] pl-10 pr-3 text-sm outline-none focus:border-[rgb(var(--bubo-color-primary))]"
            />
          </div>
        </Card>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar acervo">
        {filters.map((item) => {
          const count = item.key === 'all' ? books.length : books.filter((book) => book.status === item.key).length;
          const active = filter === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(item.key)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition ${active ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary))] text-white' : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))] hover:text-[rgb(var(--bubo-color-text))]'}`}
            >
              {item.label}<span className="text-xs opacity-75">{count}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} padding="sm">
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="mt-3 h-5 w-4/5" />
              <Skeleton className="mt-2 h-4 w-3/5" />
              <Skeleton className="mt-5 h-10 w-full" />
            </Card>
          ))}
        </section>
      ) : error && books.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Não foi possível carregar seu acervo"
          description={error}
          actionLabel="Tentar novamente"
          onAction={() => fetchLibrary({ force: true }).catch(() => {})}
        />
      ) : visibleBooks.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={books.length === 0 ? 'Seu acervo ainda está vazio' : 'Nenhum livro encontrado'}
          description={books.length === 0 ? 'Descubra seu primeiro livro e comece uma trajetória de leitura mais profunda.' : 'Altere o filtro ou a busca para encontrar outro item do seu acervo.'}
          actionLabel={books.length === 0 ? 'Descobrir livros' : undefined}
          onAction={books.length === 0 ? () => window.location.assign('/discover') : undefined}
        />
      ) : (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleBooks.map((userBook) => {
            const book = userBook.bookId || {};
            const currentPage = Number(userBook.currentPage) || 0;
            const totalPages = Number(book.totalPages) || Math.max(currentPage, 1);
            return (
              <Card key={userBook._id} padding="sm" interactive className="flex flex-col">
                <BookCover title={book.title} author={book.author} src={book.coverImage} />
                <h2 className="mt-3 line-clamp-2 font-extrabold leading-5">{book.title || 'Livro sem título'}</h2>
                <p className="mt-1 line-clamp-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{book.author || 'Autor não informado'}</p>
                {userBook.status === 'reading' ? <ProgressBar className="mt-4" value={currentPage} max={totalPages} /> : <div className="mt-4 h-2" />}
                <p className="mt-2 text-xs text-[rgb(var(--bubo-color-text-muted))]">
                  {userBook.status === 'reading' ? `Página ${currentPage} / ${book.totalPages || '?'}` : getBookStatusLabel(userBook.status)}
                </p>
                <div className="mt-auto space-y-2 pt-4">
                  {userBook.status === 'reading' && <Button className="w-full" size="sm" variant="secondary" onClick={() => openReview(userBook)}>Fazer review</Button>}
                  <Select
                    value={userBook.status}
                    onChange={(event) => changeStatus(userBook, event.target.value)}
                    aria-label={`Status de ${book.title || 'livro'}`}
                    disabled={isUpdating}
                  >
                    <option value="reading">Lendo</option>
                    <option value="to-read">Quero ler</option>
                    <option value="read">Lido</option>
                    <option value="abandoned">Abandonado</option>
                  </Select>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      <div className="flex items-center gap-2 text-sm text-[rgb(var(--bubo-color-text-muted))]"><Grid2X2 size={16} /><span>{visibleBooks.length} itens exibidos</span></div>
    </div>
  );
}
