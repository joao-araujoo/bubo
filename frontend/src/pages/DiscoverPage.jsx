import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Check,
  Library,
  Search,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import BookCover from '../components/books/BookCover';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import Skeleton from '../components/ui/Skeleton';
import { useLibraryStore } from '../stores/useLibraryStore';

const LAST_QUERY_KEY = 'bubo:last-book-query';

const statusOptions = [
  { value: 'to-read', label: 'Quero ler', description: 'Adiciona à sua lista para começar depois.' },
  { value: 'reading', label: 'Estou lendo', description: 'Deixa o livro pronto para progresso e Deep Review.' },
  { value: 'read', label: 'Já li', description: 'Marca a leitura como concluída.' },
];

const getBookId = (book) => book.canonicalId || book.googleBooksId || book.openLibraryKey || book.isbn;

export default function DiscoverPage() {
  const { addBook, books, fetchLibrary, updatingIds } = useLibraryStore();
  const [input, setInput] = useState(() => sessionStorage.getItem(LAST_QUERY_KEY) || '');
  const [query, setQuery] = useState(() => sessionStorage.getItem(LAST_QUERY_KEY) || '');
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('to-read');

  useEffect(() => {
    fetchLibrary().catch(() => {});
  }, [fetchLibrary]);

  const searchResult = useQuery({
    queryKey: ['book-search', query],
    enabled: Boolean(query),
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
    placeholderData: (previousData) => previousData,
    queryFn: async ({ signal }) => {
      const { data } = await api.get('/books/search', {
        params: { q: query },
        signal,
      });
      return data;
    },
  });

  const results = searchResult.data?.books || [];
  const libraryIds = useMemo(() => new Set(books.flatMap((userBook) => {
    const book = userBook.bookId || {};
    return [book.canonicalId, book.googleBooksId, book.openLibraryKey, book.isbn].filter(Boolean);
  })), [books]);

  const isInLibrary = (book) => [book.canonicalId, book.googleBooksId, book.openLibraryKey, book.isbn]
    .filter(Boolean)
    .some((id) => libraryIds.has(id));

  const submitSearch = (event) => {
    event.preventDefault();
    const normalized = input.trim().replace(/\s+/g, ' ');
    if (!normalized) {
      toast.error('Digite um título, autor ou ISBN.');
      return;
    }
    sessionStorage.setItem(LAST_QUERY_KEY, normalized);
    setInput(normalized);
    setQuery(normalized);
  };

  const openAddBook = (book) => {
    setSelectedBook(book);
    setSelectedStatus('to-read');
  };

  const confirmAdd = async () => {
    if (!selectedBook) return;
    try {
      const userBook = await addBook(selectedBook, selectedStatus);
      toast.success(`“${selectedBook.title}” foi adicionado ao seu acervo.`);
      setSelectedBook(null);
      if (selectedStatus === 'reading') {
        window.dispatchEvent(new CustomEvent('bubo:library-book-added', { detail: { userBook } }));
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const selectedBookId = selectedBook ? getBookId(selectedBook) : null;
  const isAdding = selectedBookId
    ? updatingIds.includes(`adding:${selectedBookId}`)
    : false;

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-[1.75rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] shadow-[var(--bubo-shadow-sm)]">
        <div className="grid gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1fr_18rem] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.13em] text-[rgb(var(--bubo-color-primary))]">
              <Sparkles size={14} aria-hidden="true" /> Descobrir livros
            </div>
            <h1 className="mt-4 max-w-2xl text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              Encontre a edição certa e coloque a leitura em movimento.
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-[rgb(var(--bubo-color-text-muted))]">
              Busque por título, autor ou ISBN. O Bubo combina catálogos e organiza os resultados pela proximidade com o que você digitou.
            </p>
          </div>
          <div className="hidden justify-self-end rounded-[1.5rem] bg-[rgb(var(--bubo-color-primary)/0.07)] p-7 text-[rgb(var(--bubo-color-primary))] lg:block">
            <Library size={88} strokeWidth={1.25} aria-hidden="true" />
          </div>
        </div>

        <form className="border-t border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted)/0.55)] p-4 sm:p-6" onSubmit={submitSearch}>
          <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Buscar livros</span>
              <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--bubo-color-text-muted))]" aria-hidden="true" />
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="min-h-14 w-full rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] pl-12 pr-4 text-base shadow-[var(--bubo-shadow-sm)] outline-none transition focus:border-[rgb(var(--bubo-color-primary))] focus:ring-4 focus:ring-[rgb(var(--bubo-color-primary)/0.1)]"
                placeholder="Ex.: Torto Arado, Itamar Vieira Junior ou ISBN"
                autoComplete="off"
              />
            </label>
            <Button type="submit" size="lg" className="sm:min-w-36" isLoading={searchResult.isFetching && !searchResult.data}>
              Buscar
            </Button>
          </div>
        </form>
      </section>

      {!query ? (
        <EmptyState
          icon={BookOpen}
          title="Qual livro você está procurando?"
          description="A busca só acontece quando você solicitar. Nada será recarregado automaticamente ao entrar nesta página."
        />
      ) : searchResult.isLoading ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Card key={index} padding="sm">
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="mt-4 h-5 w-4/5" />
              <Skeleton className="mt-2 h-4 w-3/5" />
              <Skeleton className="mt-5 h-10 w-full" />
            </Card>
          ))}
        </section>
      ) : searchResult.isError ? (
        <EmptyState
          icon={Search}
          title="A busca não respondeu"
          description={searchResult.error?.response?.data?.message || 'O catálogo está temporariamente indisponível. Seu acervo continua intacto.'}
          actionLabel="Tentar novamente"
          onAction={() => searchResult.refetch()}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhum livro encontrado"
          description="Tente um título mais curto, o nome do autor ou o ISBN impresso na edição."
        />
      ) : (
        <section aria-label={`Resultados para ${query}`}>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgb(var(--bubo-color-primary))]">Resultados</p>
              <h2 className="mt-1 text-2xl font-black">{results.length} opções para “{query}”</h2>
            </div>
            {searchResult.isFetching && <span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">Atualizando…</span>}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {results.map((book) => {
              const bookId = getBookId(book);
              const alreadyAdded = isInLibrary(book);
              return (
                <article
                  key={bookId}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-3 shadow-[var(--bubo-shadow-sm)] transition hover:-translate-y-0.5 hover:border-[rgb(var(--bubo-color-primary)/0.28)] hover:shadow-[var(--bubo-shadow-md)] sm:p-4"
                >
                  <BookCover title={book.title} author={book.author} src={book.coverImage} />
                  <div className="flex flex-1 flex-col">
                    <h3 className="mt-4 line-clamp-2 font-extrabold leading-5">{book.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-[rgb(var(--bubo-color-text-muted))]">{book.author || 'Autor não informado'}</p>
                    <p className="mt-3 text-xs leading-5 text-[rgb(var(--bubo-color-text-muted))]">
                      {[book.publishedDate?.slice(0, 4), book.totalPages ? `${book.totalPages} páginas` : null]
                        .filter(Boolean)
                        .join(' · ') || 'Detalhes da edição indisponíveis'}
                    </p>
                    <Button
                      className="mt-auto w-full pt-0"
                      size="sm"
                      variant={alreadyAdded ? 'secondary' : 'primary'}
                      disabled={alreadyAdded}
                      leftIcon={alreadyAdded ? <Check size={16} aria-hidden="true" /> : <BookOpen size={16} aria-hidden="true" />}
                      onClick={() => openAddBook(book)}
                    >
                      {alreadyAdded ? 'No acervo' : 'Adicionar'}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <Modal
        isOpen={Boolean(selectedBook)}
        onClose={() => !isAdding && setSelectedBook(null)}
        closeOnBackdrop={!isAdding}
        closeOnEscape={!isAdding}
        size="lg"
        title="Adicionar ao acervo"
        description="Escolha como esta leitura entra na sua biblioteca. Você poderá alterar tudo depois."
        footer={(
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setSelectedBook(null)} disabled={isAdding}>Cancelar</Button>
            <Button onClick={confirmAdd} isLoading={isAdding} leftIcon={<Library size={17} aria-hidden="true" />}>Adicionar ao acervo</Button>
          </div>
        )}
      >
        {selectedBook && (
          <div className="grid gap-6 sm:grid-cols-[9rem_1fr]">
            <div className="mx-auto w-32 sm:mx-0 sm:w-36">
              <BookCover title={selectedBook.title} author={selectedBook.author} src={selectedBook.coverImage} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-black leading-tight">{selectedBook.title}</h3>
              <p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{selectedBook.author || 'Autor não informado'}</p>
              <p className="mt-3 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
                {selectedBook.totalPages
                  ? `${selectedBook.totalPages} páginas nesta edição.`
                  : 'O total de páginas não foi encontrado. Você poderá informar sua edição dentro do acervo.'}
              </p>

              <Select
                className="mt-5"
                label="Como você quer adicionar?"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
              <p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
                {statusOptions.find((option) => option.value === selectedStatus)?.description}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
