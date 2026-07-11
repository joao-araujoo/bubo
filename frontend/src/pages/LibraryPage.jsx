import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Library,
  MoreHorizontal,
  Play,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import BookCover from '../components/books/BookCover';
import LibraryBookModal from '../components/books/LibraryBookModal';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ProgressBar from '../components/ui/ProgressBar';
import Select from '../components/ui/Select';
import Skeleton from '../components/ui/Skeleton';
import { useLibraryStore } from '../stores/useLibraryStore';
import { formatNumber, getBookStatusLabel } from '../utils/formatters';

const filters = [
  { key: 'all', label: 'Todos' },
  { key: 'reading', label: 'Lendo' },
  { key: 'to-read', label: 'Quero ler' },
  { key: 'read', label: 'Lidos' },
  { key: 'abandoned', label: 'Abandonados' },
];

const getEffectiveTotal = (userBook) => Number(userBook.totalPagesOverride)
  || Number(userBook.bookId?.totalPages)
  || 0;

export default function LibraryPage() {
  const {
    books,
    error,
    fetchLibrary,
    isLoading,
    updateBookStatus,
    updatingIds,
  } = useLibraryStore();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [selectedBookId, setSelectedBookId] = useState(null);

  useEffect(() => {
    fetchLibrary().catch(() => {});
  }, [fetchLibrary]);

  const selectedBook = books.find((book) => book._id === selectedBookId) || null;

  const visibleBooks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = books.filter((userBook) => {
      const book = userBook.bookId || {};
      const matchesStatus = filter === 'all' || userBook.status === filter;
      const matchesSearch = !normalized || `${book.title || ''} ${book.author || ''}`.toLowerCase().includes(normalized);
      return matchesStatus && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'title') return String(a.bookId?.title || '').localeCompare(String(b.bookId?.title || ''), 'pt-BR');
      if (sort === 'progress') {
        const aTotal = getEffectiveTotal(a) || 1;
        const bTotal = getEffectiveTotal(b) || 1;
        return (Number(b.currentPage || 0) / bTotal) - (Number(a.currentPage || 0) / aTotal);
      }
      return new Date(b.updatedAt || b.addedAt || 0) - new Date(a.updatedAt || a.addedAt || 0);
    });
  }, [books, filter, query, sort]);

  const pagesRegistered = books.reduce((total, userBook) => total + (Number(userBook.currentPage) || 0), 0);
  const readingCount = books.filter((book) => book.status === 'reading').length;
  const completedCount = books.filter((book) => book.status === 'read').length;

  const startReading = async (userBook) => {
    try {
      await updateBookStatus(userBook._id, { status: 'reading' });
      toast.success(`Você começou “${userBook.bookId?.title || 'esta leitura'}”.`);
    } catch (statusError) {
      toast.error(statusError.message);
    }
  };

  const openReview = (userBook) => {
    window.dispatchEvent(new CustomEvent('bubo:open-deep-review', { detail: { userBook } }));
  };

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[1.75rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] shadow-[var(--bubo-shadow-sm)]">
        <div className="flex flex-col gap-5 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-[rgb(var(--bubo-color-primary))]">
              <Library size={14} aria-hidden="true" /> Seu acervo
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-4xl">Sua leitura, organizada para avançar.</h1>
            <p className="mt-2 max-w-2xl leading-7 text-[rgb(var(--bubo-color-text-muted))]">
              Comece livros, ajuste a edição, registre páginas e abra uma Deep Review sem procurar ações escondidas.
            </p>
          </div>
          <Button as={Link} to="/discover" size="lg" leftIcon={<Plus size={18} aria-hidden="true" />}>Adicionar livro</Button>
        </div>

        <div className="grid grid-cols-3 border-t border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted)/0.45)]">
          <div className="px-3 py-4 text-center sm:px-6">
            <strong className="block text-2xl font-black text-[rgb(var(--bubo-color-primary))]">{readingCount}</strong>
            <span className="text-xs text-[rgb(var(--bubo-color-text-muted))] sm:text-sm">lendo</span>
          </div>
          <div className="border-x border-[rgb(var(--bubo-color-border))] px-3 py-4 text-center sm:px-6">
            <strong className="block text-2xl font-black text-[rgb(var(--bubo-color-primary))]">{completedCount}</strong>
            <span className="text-xs text-[rgb(var(--bubo-color-text-muted))] sm:text-sm">concluídos</span>
          </div>
          <div className="px-3 py-4 text-center sm:px-6">
            <strong className="block text-2xl font-black text-[rgb(var(--bubo-color-primary))]">{formatNumber(pagesRegistered)}</strong>
            <span className="text-xs text-[rgb(var(--bubo-color-text-muted))] sm:text-sm">páginas</span>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4 shadow-[var(--bubo-shadow-sm)] sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_12rem]">
          <label className="relative">
            <span className="sr-only">Pesquisar no acervo</span>
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--bubo-color-text-muted))]" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pesquise por título ou autor"
              className="min-h-12 w-full rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] pl-11 pr-4 text-sm outline-none transition focus:border-[rgb(var(--bubo-color-primary))] focus:ring-4 focus:ring-[rgb(var(--bubo-color-primary)/0.1)]"
            />
          </label>
          <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar acervo">
            <option value="recent">Mais recentes</option>
            <option value="title">Título</option>
            <option value="progress">Maior progresso</option>
          </Select>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar acervo">
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
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))] ${active ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary))] text-white' : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))] hover:text-[rgb(var(--bubo-color-text))]'}`}
              >
                {item.label}<span className="text-xs opacity-75">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {isLoading ? (
        <section className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-[1.25rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4">
              <div className="flex gap-4">
                <Skeleton className="h-36 w-24 shrink-0" />
                <div className="flex-1"><Skeleton className="h-5 w-4/5" /><Skeleton className="mt-2 h-4 w-3/5" /><Skeleton className="mt-7 h-3 w-full" /></div>
              </div>
              <Skeleton className="mt-4 h-10 w-full" />
            </div>
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
          description={books.length === 0 ? 'Adicione seu primeiro livro e escolha se quer começar agora ou guardar para depois.' : 'Altere o filtro ou a pesquisa para encontrar outro livro.'}
          actionLabel={books.length === 0 ? 'Descobrir livros' : undefined}
          onAction={books.length === 0 ? () => window.location.assign('/discover') : undefined}
        />
      ) : (
        <section className="grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleBooks.map((userBook) => {
            const book = userBook.bookId || {};
            const currentPage = Number(userBook.currentPage) || 0;
            const totalPages = getEffectiveTotal(userBook);
            const isUpdating = updatingIds.includes(userBook._id);
            return (
              <article key={userBook._id} className="flex min-w-0 flex-col rounded-[1.25rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4 shadow-[var(--bubo-shadow-sm)] transition hover:border-[rgb(var(--bubo-color-primary)/0.28)] hover:shadow-[var(--bubo-shadow-md)]">
                <div className="flex min-w-0 gap-4">
                  <div className="w-24 shrink-0"><BookCover title={book.title} author={book.author} src={book.coverImage} /></div>
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex rounded-full bg-[rgb(var(--bubo-color-primary)/0.09)] px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--bubo-color-primary))]">
                      {getBookStatusLabel(userBook.status)}
                    </span>
                    <h2 className="mt-2 line-clamp-2 font-extrabold leading-5">{book.title || 'Livro sem título'}</h2>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-[rgb(var(--bubo-color-text-muted))]">{book.author || 'Autor não informado'}</p>
                  </div>
                </div>

                <div className="mt-4 min-h-12">
                  {userBook.status === 'reading' ? (
                    <>
                      <div className="flex items-center justify-between gap-3 text-xs text-[rgb(var(--bubo-color-text-muted))]">
                        <span>Página {currentPage}</span><span>{totalPages > 0 ? `${totalPages} no total` : 'total não informado'}</span>
                      </div>
                      <ProgressBar className="mt-2" value={currentPage} max={totalPages || Math.max(currentPage, 1)} />
                    </>
                  ) : (
                    <p className="text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
                      {userBook.status === 'to-read' ? 'Pronto para começar quando você quiser.' : userBook.status === 'read' ? 'Leitura concluída.' : 'Leitura pausada no acervo.'}
                    </p>
                  )}
                </div>

                <div className="mt-auto grid grid-cols-[1fr_auto] gap-2 pt-4">
                  {userBook.status === 'reading' ? (
                    <Button size="sm" onClick={() => openReview(userBook)} disabled={isUpdating} leftIcon={<Sparkles size={16} aria-hidden="true" />}>Deep Review</Button>
                  ) : userBook.status === 'to-read' ? (
                    <Button size="sm" onClick={() => startReading(userBook)} isLoading={isUpdating} leftIcon={<Play size={16} aria-hidden="true" />}>Começar</Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setSelectedBookId(userBook._id)}>Ver leitura</Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => setSelectedBookId(userBook._id)} aria-label={`Gerenciar ${book.title || 'livro'}`} className="w-10 px-0">
                    <MoreHorizontal size={18} aria-hidden="true" />
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <LibraryBookModal
        isOpen={Boolean(selectedBook)}
        userBook={selectedBook}
        onClose={() => setSelectedBookId(null)}
      />
    </div>
  );
}
