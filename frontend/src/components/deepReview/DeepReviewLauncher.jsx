import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Play, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BookCover from '../books/BookCover';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import ProgressBar from '../ui/ProgressBar';
import { useAchievementStore } from '../../stores/useAchievementStore';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useSocialStore } from '../../stores/useSocialStore';
import DeepReviewModal from './DeepReviewModal';

const effectiveTotal = (userBook) => Number(userBook.totalPagesOverride)
  || Number(userBook.bookId?.totalPages)
  || 0;

export default function DeepReviewLauncher() {
  const navigate = useNavigate();
  const { books, fetchLibrary, updateBookStatus, updatingIds } = useLibraryStore();
  const { fetchDashboard } = useDashboardStore();
  const { fetchAchievements } = useAchievementStore();
  const { fetchFeed } = useSocialStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const eligibleBooks = useMemo(() => books.filter((item) => (
    item.status === 'reading' || item.status === 'to-read'
  )), [books]);

  useEffect(() => {
    fetchLibrary().catch(() => {});
  }, [fetchLibrary]);

  useEffect(() => {
    const openReview = (event) => {
      const requestedBook = event.detail?.userBook;
      if (requestedBook) {
        setSelectedBook(requestedBook);
        setIsOpen(true);
        return;
      }

      if (eligibleBooks.length === 0) {
        toast.error('Adicione um livro ou comece uma leitura antes de fazer uma Deep Review.');
        navigate('/discover');
        return;
      }

      if (eligibleBooks.length === 1) {
        setSelectedBook(eligibleBooks[0]);
        setIsOpen(true);
        return;
      }

      setIsPickerOpen(true);
    };

    window.addEventListener('bubo:open-deep-review', openReview);
    return () => window.removeEventListener('bubo:open-deep-review', openReview);
  }, [eligibleBooks, navigate]);

  const chooseBook = async (userBook) => {
    let chosen = userBook;
    if (userBook.status !== 'reading') {
      try {
        chosen = await updateBookStatus(userBook._id, { status: 'reading' });
      } catch (error) {
        toast.error(error.message);
        return;
      }
    }

    setSelectedBook(chosen);
    setIsPickerOpen(false);
    setIsOpen(true);
  };

  const refreshConnectedData = async () => {
    await Promise.allSettled([
      fetchLibrary({ force: true }),
      fetchDashboard(),
      fetchAchievements(),
      fetchFeed(),
    ]);
  };

  return (
    <>
      <Modal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        size="lg"
        title="Escolha a leitura"
        description="A Deep Review será vinculada ao livro e continuará a partir da página atual."
      >
        <div className="space-y-3">
          {eligibleBooks.map((userBook) => {
            const book = userBook.bookId || {};
            const total = effectiveTotal(userBook);
            const current = Number(userBook.currentPage) || 0;
            const isUpdating = updatingIds.includes(userBook._id);
            return (
              <article key={userBook._id} className="grid gap-4 rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] p-4 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center">
                <div className="mx-auto w-16 sm:mx-0 sm:w-[4.5rem]">
                  <BookCover title={book.title} author={book.author} src={book.coverImage} />
                </div>
                <div className="min-w-0 text-center sm:text-left">
                  <h3 className="line-clamp-1 font-extrabold">{book.title || 'Livro sem título'}</h3>
                  <p className="mt-1 line-clamp-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{book.author || 'Autor não informado'}</p>
                  {userBook.status === 'reading' ? (
                    <div className="mt-3">
                      <div className="flex justify-between gap-3 text-xs text-[rgb(var(--bubo-color-text-muted))]"><span>Página {current}</span><span>{total > 0 ? `${total} no total` : 'total não informado'}</span></div>
                      <ProgressBar className="mt-1.5" value={current} max={total || Math.max(current, 1)} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs font-bold text-[rgb(var(--bubo-color-primary))]">Será marcado como “Lendo” ao continuar.</p>
                  )}
                </div>
                <Button
                  onClick={() => chooseBook(userBook)}
                  isLoading={isUpdating}
                  leftIcon={userBook.status === 'reading' ? <Sparkles size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                  className="w-full sm:w-auto"
                >
                  {userBook.status === 'reading' ? 'Revisar' : 'Começar'}
                </Button>
              </article>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-[var(--bubo-radius-lg)] bg-[rgb(var(--bubo-color-surface-muted))] p-4 text-center sm:flex-row sm:text-left">
          <p className="flex items-center gap-2 text-sm text-[rgb(var(--bubo-color-text-muted))]"><BookOpen size={17} aria-hidden="true" /> O livro que você procura não está aqui?</p>
          <Button variant="secondary" onClick={() => { setIsPickerOpen(false); navigate('/library'); }}>Abrir acervo</Button>
        </div>
      </Modal>

      <DeepReviewModal
        isOpen={isOpen}
        userBook={selectedBook}
        onClose={() => setIsOpen(false)}
        onCompleted={refreshConnectedData}
      />
    </>
  );
}
