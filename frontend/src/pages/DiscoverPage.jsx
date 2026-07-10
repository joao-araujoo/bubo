import React, { useEffect, useState } from 'react';
import { BookOpen, Check, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import BookCover from '../components/books/BookCover';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Skeleton from '../components/ui/Skeleton';
import { useLibraryStore } from '../stores/useLibraryStore';

export default function DiscoverPage() {
  const { addBook, books, fetchLibrary, isUpdating } = useLibraryStore();
  const [input, setInput] = useState('Dom Casmurro');
  const [query, setQuery] = useState('Dom Casmurro');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingId, setAddingId] = useState(null);

  useEffect(() => {
    fetchLibrary().catch(() => {});
  }, [fetchLibrary]);

  useEffect(() => {
    let active = true;

    const runInitialSearch = async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const { data } = await api.get('/books/search', { params: { q: query } });
        if (active) setResults(data.books || []);
      } catch (error) {
        if (active) setSearchError(error.response?.data?.message || 'Não foi possível buscar livros agora.');
      } finally {
        if (active) {
          setIsSearching(false);
          setHasSearched(true);
        }
      }
    };

    runInitialSearch();
    return () => { active = false; };
  }, [query]);

  const search = (event) => {
    event.preventDefault();
    const normalized = input.trim();
    if (!normalized) return;
    setQuery(normalized);
  };

  const isInLibrary = (book) => books.some((userBook) => {
    const existing = userBook.bookId || {};
    return existing.googleBooksId === book.googleBooksId || (
      existing.title === book.title && existing.author === book.author
    );
  });

  const handleAdd = async (book) => {
    setAddingId(book.googleBooksId);
    try {
      await addBook(book, 'to-read');
      toast.success(`“${book.title}” foi adicionado ao seu acervo.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={search}>
          <label className="relative flex-1">
            <span className="sr-only">Buscar livros</span>
            <Search size={19} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--bubo-color-text-muted))]" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-h-12 w-full rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] pl-10 pr-3 outline-none focus:border-[rgb(var(--bubo-color-primary))]"
              placeholder="Título, autor ou ISBN"
            />
          </label>
          <Button type="submit" className="sm:min-w-28" isLoading={isSearching}>Buscar</Button>
        </form>
      </Card>

      <section>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Resultado</p>
        <h1 className="mt-1 text-2xl font-black">{hasSearched ? `${results.length} livros encontrados` : 'Encontre sua próxima leitura'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
          Quando faltarem capa, autor ou número de páginas, o Bubo usa um fallback editável em vez de exibir conteúdo quebrado.
        </p>
      </section>

      {isSearching ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Card key={index} padding="sm">
              <Skeleton className="aspect-[2/3] w-full" />
              <Skeleton className="mt-3 h-5 w-4/5" />
              <Skeleton className="mt-2 h-4 w-3/5" />
              <Skeleton className="mt-5 h-9 w-full" />
            </Card>
          ))}
        </section>
      ) : searchError ? (
        <EmptyState
          icon={Search}
          title="A busca não respondeu"
          description={searchError}
          actionLabel="Tentar novamente"
          onAction={() => setQuery(`${input.trim()} `)}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={hasSearched ? 'Nenhum resultado' : 'Busque um livro'}
          description={hasSearched ? 'Tente buscar por outro título, autor ou ISBN.' : 'Pesquise pelo que você quer ler e adicione ao seu acervo.'}
        />
      ) : (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((book) => {
            const alreadyAdded = isInLibrary(book);
            const isAdding = addingId === book.googleBooksId;
            return (
              <Card key={book.googleBooksId} padding="sm" interactive className="flex flex-col">
                <BookCover title={book.title} author={book.author} src={book.coverImage} />
                <h2 className="mt-3 line-clamp-2 font-extrabold leading-5">{book.title}</h2>
                <p className="mt-1 line-clamp-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{book.author || 'Autor não informado'}</p>
                <p className="mt-3 text-xs leading-5 text-[rgb(var(--bubo-color-text-muted))]">{book.totalPages ? `${book.totalPages} páginas` : 'Páginas não informadas · editável'}</p>
                <Button
                  className="mt-auto w-full"
                  size="sm"
                  variant={alreadyAdded ? 'secondary' : 'primary'}
                  disabled={alreadyAdded || (isUpdating && !isAdding)}
                  isLoading={isAdding}
                  leftIcon={alreadyAdded ? <Check size={16} /> : undefined}
                  onClick={() => handleAdd(book)}
                >
                  {alreadyAdded ? 'No acervo' : 'Adicionar'}
                </Button>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
