import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Play,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLibraryStore } from '../../stores/useLibraryStore';
import BookCover from './BookCover';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import ProgressBar from '../ui/ProgressBar';
import Select from '../ui/Select';

const statusOptions = [
  { value: 'to-read', label: 'Quero ler' },
  { value: 'reading', label: 'Lendo' },
  { value: 'read', label: 'Lido' },
  { value: 'abandoned', label: 'Abandonado' },
];

export default function LibraryBookModal({ isOpen, onClose, userBook }) {
  const { removeBook, updateBookStatus, updatingIds } = useLibraryStore();
  const [status, setStatus] = useState('to-read');
  const [currentPage, setCurrentPage] = useState('0');
  const [totalPages, setTotalPages] = useState('');
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);

  const book = userBook?.bookId || {};
  const isUpdating = userBook ? updatingIds.includes(userBook._id) : false;
  const effectiveTotal = Math.max(0, Number(totalPages) || 0);
  const normalizedCurrentPage = Math.max(0, Number(currentPage) || 0);
  const progress = effectiveTotal > 0
    ? Math.min(100, Math.round((normalizedCurrentPage / effectiveTotal) * 100))
    : 0;

  useEffect(() => {
    if (!userBook) return;
    setStatus(userBook.status || 'to-read');
    setCurrentPage(String(Number(userBook.currentPage) || 0));
    setTotalPages(String(Number(userBook.totalPagesOverride) || Number(userBook.bookId?.totalPages) || ''));
    setConfirmingRemoval(false);
  }, [userBook]);

  const hasChanges = useMemo(() => {
    if (!userBook) return false;
    const initialTotal = Number(userBook.totalPagesOverride) || Number(userBook.bookId?.totalPages) || 0;
    return status !== userBook.status
      || normalizedCurrentPage !== Number(userBook.currentPage || 0)
      || effectiveTotal !== initialTotal;
  }, [effectiveTotal, normalizedCurrentPage, status, userBook]);

  const saveChanges = async (overrides = {}) => {
    if (!userBook) return null;
    const nextStatus = overrides.status ?? status;
    const nextPage = overrides.currentPage ?? normalizedCurrentPage;
    const nextTotal = overrides.totalPages ?? effectiveTotal;

    if (nextTotal > 0 && nextPage > nextTotal) {
      toast.error('A página atual não pode ultrapassar o total da edição.');
      return null;
    }

    try {
      const updated = await updateBookStatus(userBook._id, {
        status: nextStatus,
        currentPage: nextPage,
        totalPages: nextTotal,
      });
      setStatus(updated.status);
      setCurrentPage(String(Number(updated.currentPage) || 0));
      setTotalPages(String(Number(updated.totalPagesOverride) || Number(updated.bookId?.totalPages) || ''));
      toast.success('Leitura atualizada.');
      return updated;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  };

  const startReading = async () => {
    const updated = await saveChanges({ status: 'reading' });
    if (updated) setStatus('reading');
  };

  const startDeepReview = async () => {
    const updated = await saveChanges({ status: 'reading' });
    if (!updated) return;
    onClose?.();
    window.dispatchEvent(new CustomEvent('bubo:open-deep-review', { detail: { userBook: updated } }));
  };

  const remove = async () => {
    if (!userBook) return;
    try {
      await removeBook(userBook._id);
      toast.success('Livro removido do acervo.');
      onClose?.();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (!userBook) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isUpdating && onClose?.()}
      closeOnBackdrop={!isUpdating}
      closeOnEscape={!isUpdating}
      size="lg"
      title="Gerenciar leitura"
      description="Atualize o status, a edição e o progresso sem sair do seu acervo."
      footer={(
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => setConfirmingRemoval(true)}
            disabled={isUpdating}
            leftIcon={<Trash2 size={17} aria-hidden="true" />}
            className="text-[rgb(var(--bubo-color-danger))]"
          >
            Remover
          </Button>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button variant="secondary" onClick={onClose} disabled={isUpdating}>Fechar</Button>
            <Button onClick={() => saveChanges()} disabled={!hasChanges} isLoading={isUpdating} leftIcon={<Save size={17} aria-hidden="true" />}>
              Salvar alterações
            </Button>
          </div>
        </div>
      )}
    >
      <div className="grid gap-7 lg:grid-cols-[11rem_1fr]">
        <aside>
          <div className="mx-auto w-40 lg:w-44">
            <BookCover title={book.title} author={book.author} src={book.coverImage} />
          </div>
          <div className="mt-4 text-center lg:text-left">
            <h3 className="font-black leading-tight">{book.title || 'Livro sem título'}</h3>
            <p className="mt-1 text-sm leading-5 text-[rgb(var(--bubo-color-text-muted))]">{book.author || 'Autor não informado'}</p>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <section className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted)/0.5)] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[rgb(var(--bubo-color-primary))]">Progresso</p>
                <p className="mt-1 text-2xl font-black">{progress}%</p>
              </div>
              <span className="text-sm text-[rgb(var(--bubo-color-text-muted))]">
                Página {normalizedCurrentPage}{effectiveTotal > 0 ? ` de ${effectiveTotal}` : ''}
              </span>
            </div>
            <ProgressBar className="mt-4" value={normalizedCurrentPage} max={effectiveTotal || Math.max(normalizedCurrentPage, 1)} />
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Status da leitura" value={status} onChange={(event) => setStatus(event.target.value)} disabled={isUpdating}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
            <Input
              label="Páginas da minha edição"
              type="number"
              min="1"
              value={totalPages}
              onChange={(event) => setTotalPages(event.target.value)}
              placeholder="Ex.: 320"
              description={book.totalPages ? `Catálogo: ${book.totalPages} páginas. Você pode corrigir para sua edição.` : 'Informe para obter progresso preciso.'}
              disabled={isUpdating}
            />
            <Input
              label="Página atual"
              type="number"
              min="0"
              max={effectiveTotal || undefined}
              value={currentPage}
              onChange={(event) => setCurrentPage(event.target.value)}
              description="A Deep Review validará apenas páginas posteriores a esta."
              disabled={isUpdating}
            />
          </div>

          <section className="grid gap-3 sm:grid-cols-2">
            {status === 'to-read' && (
              <Button onClick={startReading} isLoading={isUpdating} leftIcon={<Play size={17} aria-hidden="true" />}>
                Começar leitura
              </Button>
            )}
            {status === 'read' && (
              <div className="flex min-h-12 items-center gap-3 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-success)/0.08)] px-4 text-sm font-bold text-[rgb(var(--bubo-color-success))]">
                <CheckCircle2 size={18} aria-hidden="true" /> Leitura concluída
              </div>
            )}
            <Button
              variant={status === 'reading' ? 'primary' : 'secondary'}
              onClick={startDeepReview}
              isLoading={isUpdating}
              leftIcon={<Sparkles size={17} aria-hidden="true" />}
            >
              {status === 'reading' ? 'Fazer Deep Review' : 'Começar e revisar'}
            </Button>
          </section>

          <div className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] p-4 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
            <p className="flex items-center gap-2 font-extrabold text-[rgb(var(--bubo-color-text))]"><BookOpen size={17} aria-hidden="true" /> Como funciona</p>
            <p className="mt-1">Atualize a página depois de ler ou use a Deep Review para validar um novo trecho e avançar automaticamente.</p>
          </div>
        </div>
      </div>

      {confirmingRemoval && (
        <div className="mt-7 rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-danger)/0.28)] bg-[rgb(var(--bubo-color-danger)/0.06)] p-4" role="alert">
          <p className="font-extrabold text-[rgb(var(--bubo-color-danger))]">Remover “{book.title}” do acervo?</p>
          <p className="mt-1 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">O progresso e as Deep Reviews vinculadas a esta leitura serão removidos. Essa ação não pode ser desfeita.</p>
          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirmingRemoval(false)} disabled={isUpdating}>Manter livro</Button>
            <Button variant="danger" onClick={remove} isLoading={isUpdating} leftIcon={<Trash2 size={17} aria-hidden="true" />}>Remover definitivamente</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
