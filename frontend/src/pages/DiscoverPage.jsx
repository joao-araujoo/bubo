import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  CircleAlert,
  CircleCheck,
  Database,
  ExternalLink,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import BookCover from '../components/books/BookCover';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Input from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import Skeleton from '../components/ui/Skeleton';
import { useLibraryStore } from '../stores/useLibraryStore';

const confidenceLabels = {
  high: 'Dados confirmados',
  medium: 'Dados parciais',
  low: 'Revisar dados',
};

const sourceLabels = {
  google_books: 'Google Books',
  open_library: 'Open Library',
};

export default function DiscoverPage() {
  const { addBook, books, fetchLibrary, isUpdating } = useLibraryStore();
  const [input, setInput] = useState('Dom Casmurro');
  const [query, setQuery] = useState('Dom Casmurro');
  const [results, setResults] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [pendingBook, setPendingBook] = useState(null);
  const [manualPages, setManualPages] = useState('');

  useEffect(() => {
    fetchLibrary().catch(() => {});
  }, [fetchLibrary]);

  useEffect(() => {
    let active = true;

    const runSearch = async () => {
      setIsSearching(true);
      setSearchError(null);
      try {
        const { data } = await api.get('/books/search', { params: { q: query } });
        if (active) {
          setResults(data.books || []);
          setSearchMeta(data.meta || null);
        }
      } catch (error) {
        if (active) {
          setSearchError(error.response?.data?.message || 'Não foi possível consultar o catálogo agora.');
          setSearchMeta(error.response?.data?.sourceStatus ? {
            sourceStatus: error.response.data.sourceStatus,
            partial: false,
          } : null);
        }
      } finally {
        if (active) {
          setIsSearching(false);
          setHasSearched(true);
        }
      }
    };

    runSearch();
    return () => { active = false; };
  }, [query]);

  const search = (event) => {
    event.preventDefault();
    const normalized = input.trim();
    if (!normalized) {
      toast.error('Digite um título, autor ou ISBN.');
      return;
    }
    setQuery(normalized);
  };

  const isInLibrary = (book) => books.some((userBook) => {
    const existing = userBook.bookId || {};
    return (
      (existing.canonicalId && existing.canonicalId === book.canonicalId)
      || (existing.isbn && book.isbn && existing.isbn === book.isbn)
      || (existing.googleBooksId && existing.googleBooksId === book.googleBooksId)
      || (existing.openLibraryKey && existing.openLibraryKey === book.openLibraryKey)
      || (existing.title === book.title && existing.author === book.author)
    );
  });

  const performAdd = async (book) => {
    const id = book.canonicalId || book.googleBooksId || book.openLibraryKey;
    setAddingId(id);
    try {
      await addBook(book, 'to-read');
      toast.success(`“${book.title}” foi adicionado ao seu acervo.`);
      setPendingBook(null);
      setManualPages('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAddingId(null);
    }
  };

  const handleAdd = (book) => {
    if (!book.totalPages) {
      setPendingBook(book);
      setManualPages('');
      return;
    }
    performAdd(book);
  };

  const confirmManualPages = () => {
    const pages = Number.parseInt(manualPages, 10);
    if (!Number.isInteger(pages) || pages < 1) {
      toast.error('Informe um total de páginas válido.');
      return;
    }
    performAdd({
      ...pendingBook,
      totalPages: pages,
      pagesSource: 'manual',
      metadataSources: [...new Set([...(pendingBook.metadataSources || []), 'manual'])],
      metadataConfidence: pendingBook.coverImage && pendingBook.author ? 'high' : 'medium',
    });
  };

  const availableSources = searchMeta?.sourceStatus
    ? Object.entries(searchMeta.sourceStatus).filter(([, status]) => status === 'available').map(([source]) => sourceLabels[source])
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={search}>
          <label className="relative flex-1">
            <span className="sr-only">Buscar livros</span>
            <Search size={19} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--bubo-color-text-muted))]" aria-hidden="true" />
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-h-12 w-full rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] pl-10 pr-3 outline-none transition focus:border-[rgb(var(--bubo-color-primary))] focus:ring-4 focus:ring-[rgb(var(--bubo-color-primary)/0.1)]"
              placeholder="Título, autor ou ISBN"
            />
          </label>
          <Button type="submit" className="sm:min-w-28" isLoading={isSearching}>Buscar</Button>
        </form>
      </Card>

      <section>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]">Catálogo enriquecido</p>
        <h1 className="mt-1 text-2xl font-black">{hasSearched ? `${results.length} livros encontrados` : 'Encontre sua próxima leitura'}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
          O Bubo cruza fontes independentes para priorizar capa, autor, ISBN e número de páginas. Quando o total não pode ser confirmado, você pode informá-lo antes de adicionar.
        </p>
      </section>

      {searchMeta && (
        <div className={`flex flex-col gap-3 rounded-[var(--bubo-radius-lg)] border p-4 sm:flex-row sm:items-center sm:justify-between ${searchMeta.partial ? 'border-[rgb(var(--bubo-color-warning)/0.3)] bg-[rgb(var(--bubo-color-warning)/0.07)]' : 'border-[rgb(var(--bubo-color-success)/0.24)] bg-[rgb(var(--bubo-color-success)/0.06)]'}`}>
          <div className="flex items-start gap-3">
            {searchMeta.partial ? <CircleAlert size={20} className="mt-0.5 shrink-0 text-[rgb(var(--bubo-color-warning))]" aria-hidden="true" /> : <CircleCheck size={20} className="mt-0.5 shrink-0 text-[rgb(var(--bubo-color-success))]" aria-hidden="true" />}
            <div>
              <p className="font-extrabold">{searchMeta.partial ? 'Busca concluída com uma fonte indisponível' : 'Metadados cruzados com sucesso'}</p>
              <p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">Fontes ativas: {availableSources.join(' e ') || 'nenhuma fonte confirmou resposta'}.</p>
            </div>
          </div>
          <Database size={20} className="hidden shrink-0 text-[rgb(var(--bubo-color-text-muted))] sm:block" aria-hidden="true" />
        </div>
      )}

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
          title="O catálogo não respondeu"
          description={searchError}
          actionLabel="Tentar novamente"
          onAction={() => setQuery(`${input.trim()} `)}
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={hasSearched ? 'Nenhum resultado' : 'Busque um livro'}
          description={hasSearched ? 'Tente outro título, autor ou ISBN. Nenhum item incompleto foi inventado.' : 'Pesquise pelo que você quer ler e adicione ao seu acervo.'}
        />
      ) : (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {results.map((book) => {
            const bookId = book.canonicalId || book.googleBooksId || book.openLibraryKey;
            const alreadyAdded = isInLibrary(book);
            const isAdding = addingId === bookId;
            const confidence = book.metadataConfidence || 'low';
            return (
              <Card key={bookId} padding="sm" interactive className="flex flex-col">
                <BookCover title={book.title} author={book.author} src={book.coverImage} />
                <div className="mt-3 flex items-start justify-between gap-2">
                  <span className={`rounded-full px-2 py-1 text-[0.62rem] font-extrabold uppercase tracking-[0.06em] ${confidence === 'high' ? 'bg-[rgb(var(--bubo-color-success)/0.1)] text-[rgb(var(--bubo-color-success))]' : confidence === 'medium' ? 'bg-[rgb(var(--bubo-color-warning)/0.1)] text-[rgb(var(--bubo-color-warning))]' : 'bg-[rgb(var(--bubo-color-surface-muted))] text-[rgb(var(--bubo-color-text-muted))]'}`}>
                    {confidenceLabels[confidence]}
                  </span>
                  {book.previewLink && (
                    <a href={book.previewLink} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-full text-[rgb(var(--bubo-color-text-muted))] hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-primary))]" aria-label={`Abrir detalhes externos de ${book.title}`}>
                      <ExternalLink size={15} aria-hidden="true" />
                    </a>
                  )}
                </div>
                <h2 className="mt-2 line-clamp-2 font-extrabold leading-5">{book.title}</h2>
                <p className="mt-1 line-clamp-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{book.author || 'Autor não informado'}</p>
                <div className="mt-3 min-h-10 text-xs leading-5 text-[rgb(var(--bubo-color-text-muted))]">
                  {book.totalPages ? (
                    <p><strong className="text-[rgb(var(--bubo-color-text))]">{book.totalPages} páginas</strong><br />{book.pagesSource === 'google_books' ? 'Confirmado pelo Google Books' : book.pagesSource === 'open_library_median' ? 'Mediana de edições da Open Library' : 'Informado manualmente'}</p>
                  ) : (
                    <p className="text-[rgb(var(--bubo-color-warning))]">Total de páginas não confirmado</p>
                  )}
                </div>
                <Button
                  className="mt-4 w-full"
                  size="sm"
                  variant={alreadyAdded ? 'secondary' : 'primary'}
                  disabled={alreadyAdded || (isUpdating && !isAdding)}
                  isLoading={isAdding}
                  leftIcon={alreadyAdded ? <Check size={16} aria-hidden="true" /> : undefined}
                  onClick={() => handleAdd(book)}
                >
                  {alreadyAdded ? 'No acervo' : 'Adicionar'}
                </Button>
              </Card>
            );
          })}
        </section>
      )}

      <Modal
        isOpen={Boolean(pendingBook)}
        onClose={() => { setPendingBook(null); setManualPages(''); }}
        title="Confirme o total de páginas"
        description={`Nenhuma fonte confirmou as páginas desta edição de “${pendingBook?.title || ''}”. Informe o total da sua edição para manter o progresso preciso.`}
        footer={(
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => { setPendingBook(null); setManualPages(''); }}>Cancelar</Button>
            <Button onClick={confirmManualPages} isLoading={Boolean(pendingBook && addingId)}>Adicionar ao acervo</Button>
          </div>
        )}
      >
        <Input
          label="Número total de páginas"
          type="number"
          min="1"
          value={manualPages}
          onChange={(event) => setManualPages(event.target.value)}
          placeholder="Ex.: 256"
          required
          autoFocus
        />
        <p className="mt-3 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Você poderá corrigir esse valor depois se perceber que selecionou outra edição.</p>
      </Modal>
    </div>
  );
}
