import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useLibraryStore } from '../../stores/useLibraryStore';
import DeepReviewModal from './DeepReviewModal';

export default function DeepReviewLauncher() {
  const { books, fetchLibrary } = useLibraryStore();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const defaultBook = useMemo(
    () => books.find((item) => item.status === 'reading') || books[0] || null,
    [books],
  );

  useEffect(() => {
    fetchLibrary();
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

  return (
    <DeepReviewModal
      isOpen={isOpen}
      userBook={selectedBook}
      onClose={() => setIsOpen(false)}
    />
  );
}
