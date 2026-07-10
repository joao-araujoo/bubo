import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAchievementStore } from '../../stores/useAchievementStore';
import { useDashboardStore } from '../../stores/useDashboardStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import { useSocialStore } from '../../stores/useSocialStore';
import DeepReviewModal from './DeepReviewModal';

export default function DeepReviewLauncher() {
  const { books, fetchLibrary } = useLibraryStore();
  const { fetchDashboard } = useDashboardStore();
  const { fetchAchievements } = useAchievementStore();
  const { fetchFeed } = useSocialStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const defaultBook = useMemo(
    () => books.find((item) => item.status === 'reading') || books[0] || null,
    [books],
  );

  useEffect(() => {
    fetchLibrary().catch(() => {});
  }, [fetchLibrary]);

  useEffect(() => {
    const openReview = (event) => {
      const requestedBook = event.detail?.userBook || defaultBook;
      if (!requestedBook) {
        toast.error('Adicione um livro ao seu acervo antes de fazer uma Deep Review.');
        return;
      }
      setSelectedBook(requestedBook);
      setIsOpen(true);
    };

    window.addEventListener('bubo:open-deep-review', openReview);
    return () => window.removeEventListener('bubo:open-deep-review', openReview);
  }, [defaultBook]);

  const refreshConnectedData = async () => {
    await Promise.allSettled([
      fetchLibrary({ force: true }),
      fetchDashboard(),
      fetchAchievements(),
      fetchFeed(),
    ]);
  };

  return (
    <DeepReviewModal
      isOpen={isOpen}
      userBook={selectedBook}
      onClose={() => setIsOpen(false)}
      onCompleted={refreshConnectedData}
    />
  );
}
