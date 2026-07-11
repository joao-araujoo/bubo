import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import BookCover from '../components/books/BookCover';
import BookReadingTimeline, { formatReadingDate, formatReadingDuration } from '../components/books/BookReadingTimeline';
import LibraryBookModal from '../components/books/LibraryBookModal';
import ReadingSessionModal from '../components/books/ReadingSessionModal';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import ProgressBar from '../components/ui/ProgressBar';
import Skeleton from '../components/ui/Skeleton';
import api from '../services/api';
import { useLibraryStore } from '../stores/useLibraryStore';
import { formatNumber, getBookStatusLabel } from '../utils/formatters';

const normalizeUserBook = (userBook) => {
  if (!userBook) return userBook;
  const effectiveTotalPages = Number(userBook.effectiveTotalPages)
    || Number(userBook.totalPagesOverride)
    || Number(userBook.bookId?.totalPages)
    || 0;
  return {
    ...userBook,
    effectiveTotalPages,
    bookId: { ...userBook.bookId, totalPages: effectiveTotalPages },
  };
};

export default function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { books, fetchLibrary, updateBookStatus } = useLibraryStore();
  const [isSessionOpen, setIsSessionOpen] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState(null);

  const detailQuery = useQuery({
    queryKey: ['library-book', id],
    queryFn: async () => {
      const { data } = await api.get(`/books/library/${id}`);
      return { ...data, userBook: normalizeUserBook(data.userBook) };
    },
    staleTime: 30 * 1000,
    retry: (failureCount, error) => error.response?.status !== 404 && failureCount < 2,
  });

  const deleteSession = useMutation({
    mutationFn: async (sessionId) => api.delete(`/books/library/${id}/sessions/${sessionId}`),
    onSuccess: async () => {
      toast.success('Sessão removida do histórico.');
      setSessionToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ['library-book', id] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Não foi possível remover a sessão.'),
  });

  const detail = detailQuery.data;
  const userBook = detail?.userBook;
  const book = userBook?.bookId || {};
  const currentPage = Number(userBook?.currentPage) || 0;
  const totalPages = Number(userBook?.effectiveTotalPages) || 0;
  const summary = detail?.summary || {};

  const refreshAfterChange = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['library-book', id] }),
      fetchLibrary({ force: true }),
    ]);
  };

  const closeManage = async () => {
    setIsManageOpen(false);
    const stillExists = useLibraryStore.getState().books.some((item) => item._id === id);
    if (!stillExists && books.some((item) => item._id === id)) {
      navigate('/library', { replace: true });
      return;
    }
    await refreshAfterChange();
  };

  const openDeepReview = async () => {
    if (!userBook) return;
    if (userBook.status === 'read' && totalPages > 0 && currentPage >= totalPages) {
      toast.error('Esta leitura está concluída. Reabra como “Lendo” para iniciar uma releitura.');
      setIsManageOpen(true);
      return;
    }

    let reviewBook = userBook;
    if (userBook.status !== 'reading') {
      try {
        reviewBook = normalizeUserBook(await updateBookStatus(userBook._id, { status: 'reading' }));
        await queryClient.invalidateQueries({ queryKey: ['library-book', id] });
      } catch (error) {
        toast.error(error.message);
        return;
      }
    }
    window.dispatchEvent(new CustomEvent('bubo:open-deep-review', { detail: { userBook: reviewBook } }));
  };

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-44" />
        <Skeleton className="h-[26rem] w-full rounded-[1.75rem]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 w-full" />)}
        </div>
      </div>
    );
  }

  if (detailQuery.isError || !userBook) {
    const notFound = detailQuery.error?.response?.status === 404;
    return (
      <EmptyState
        icon={BookOpen}
        title={notFound ? 'Esta leitura não está mais no seu acervo' : 'Não foi possível carregar esta leitura'}
        description={notFound ? 'O livro pode ter sido removido em outra aba ou dispositivo.' : 'Tente novamente sem perder o restante do seu acervo.'}
        actionLabel={notFound ? 'Voltar ao acervo' : 'Tentar novamente'}
        onAction={notFound ? () => navigate('/library') : () => detailQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-7">
      <Link to="/library" className="inline-flex min-h-11 items-center gap-2 rounded-[var(--bubo-radius-md)] px-2 text-sm font-bold text-[rgb(var(--bubo-color-text-muted))] transition hover:text-[rgb(var(--bubo-color-text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))]">
        <ArrowLeft size={18} aria-hidden="true" /> Voltar ao acervo
      </Link>

      <section className="overflow-hidden rounded-[1.75rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] shadow-[var(--bubo-shadow-md)]">
        <div className="grid gap-7 p-5 sm:p-8 lg:grid-cols-[13rem_1fr] lg:gap-10">
          <div className="mx-auto w-44 sm:w-52 lg:mx-0">
            <BookCover title={book.title} author={book.author} src={book.coverImage} />
          </div>

          <div className="min-w-0 self-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.1em] text-[rgb(var(--bubo-color-primary))]">{getBookStatusLabel(userBook.status)}</span>
              {book.publishedDate && <span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">{String(book.publishedDate).slice(0, 4)}</span>}
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.045em] sm:text-5xl">{book.title || 'Livro sem título'}</h1>
            {book.subtitle && <p className="mt-2 text-lg text-[rgb(var(--bubo-color-text-muted))]">{book.subtitle}</p>}
            <p className="mt-3 text-base font-semibold text-[rgb(var(--bubo-color-text-muted))]">{book.author || 'Autor não informado'}</p>

            <div className="mt-7 rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted)/0.5)] p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[rgb(var(--bubo-color-primary))]">Progresso da leitura</p>
                  <p className="mt-1 text-3xl font-black">{summary.progressPercent || 0}%</p>
                </div>
                <p className="text-sm font-semibold text-[rgb(var(--bubo-color-text-muted))]">Página {currentPage}{totalPages > 0 ? ` de ${totalPages}` : ''}</p>
              </div>
              <ProgressBar className="mt-4" value={currentPage} max={totalPages || Math.max(currentPage, 1)} />
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button size="lg" onClick={() => setIsSessionOpen(true)} leftIcon={<Plus size={18} aria-hidden="true" />}>Registrar sessão</Button>
              <Button size="lg" variant="secondary" onClick={openDeepReview} leftIcon={<Sparkles size={18} aria-hidden="true" />}>Fazer Deep Review</Button>
              <Button size="lg" variant="ghost" onClick={() => setIsManageOpen(true)} leftIcon={<Pencil size={18} aria-hidden="true" />}>Editar leitura</Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={BookOpen} label="Sessões" value={formatNumber(summary.sessionCount || 0)} />
        <Metric icon={Clock} label="Tempo registrado" value={formatReadingDuration(summary.durationMinutes)} />
        <Metric icon={Target} label="Páginas em sessões" value={formatNumber(summary.pagesReadInSessions || 0)} />
        <Metric icon={Sparkles} label="Profundidade média" value={summary.averageDepth ? `${summary.averageDepth}/100` : 'Sem avaliação'} />
      </section>

      {(book.description || book.publisher || book.isbn || userBook.startedAt) && (
        <section className="grid gap-5 rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-5 shadow-[var(--bubo-shadow-sm)] lg:grid-cols-[1fr_18rem] lg:p-7">
          <div>
            <h2 className="text-xl font-black tracking-[-0.02em]">Sobre esta edição</h2>
            <p className="mt-3 line-clamp-6 leading-7 text-[rgb(var(--bubo-color-text-muted))]">{book.description || 'Nenhuma descrição foi encontrada para esta edição.'}</p>
          </div>
          <dl className="space-y-3 text-sm">
            {book.publisher && <Metadata label="Editora" value={book.publisher} />}
            {book.isbn && <Metadata label="ISBN" value={book.isbn} />}
            {userBook.startedAt && <Metadata label="Início da leitura" value={formatReadingDate(userBook.startedAt)} />}
            {userBook.completedAt && <Metadata label="Conclusão" value={formatReadingDate(userBook.completedAt)} />}
          </dl>
        </section>
      )}

      <BookReadingTimeline reviews={detail.reviews} sessions={detail.sessions} onDeleteSession={setSessionToDelete} />

      <ReadingSessionModal isOpen={isSessionOpen} onClose={() => setIsSessionOpen(false)} userBook={userBook} onSaved={refreshAfterChange} />
      <LibraryBookModal isOpen={isManageOpen} onClose={closeManage} userBook={userBook} />

      <Modal
        isOpen={Boolean(sessionToDelete)}
        onClose={() => !deleteSession.isPending && setSessionToDelete(null)}
        closeOnBackdrop={!deleteSession.isPending}
        closeOnEscape={!deleteSession.isPending}
        size="sm"
        title="Remover sessão?"
        description="O progresso atual do livro será mantido, mas este registro sairá da linha do tempo e das métricas."
        footer={(
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setSessionToDelete(null)} disabled={deleteSession.isPending}>Cancelar</Button>
            <Button variant="danger" onClick={() => deleteSession.mutate(sessionToDelete._id)} isLoading={deleteSession.isPending} leftIcon={<Trash2 size={17} aria-hidden="true" />}>Remover sessão</Button>
          </div>
        )}
      >
        <p className="text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Sessão das páginas {sessionToDelete?.pageFrom} a {sessionToDelete?.pageTo}, registrada em {formatReadingDate(sessionToDelete?.readAt)}.</p>
      </Modal>
    </div>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <article className="rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-5 shadow-[var(--bubo-shadow-sm)]">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]"><Icon size={18} aria-hidden="true" /></span>
      <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.11em] text-[rgb(var(--bubo-color-text-muted))]">{label}</p>
      <strong className="mt-1 block text-xl font-black">{value}</strong>
    </article>
  );
}

function Metadata({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[rgb(var(--bubo-color-border))] pb-3 last:border-0 last:pb-0">
      <dt className="text-[rgb(var(--bubo-color-text-muted))]">{label}</dt>
      <dd className="max-w-[11rem] text-right font-bold">{value}</dd>
    </div>
  );
}
