import React, { useState } from 'react';
import { X, Search, Plus, Loader2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLibraryStore } from '../../stores/useLibraryStore';
import useBookSearch from '../../hooks/useBookSearch';
import toast from 'react-hot-toast';

export default function AddBookModal({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [addingId, setAddingId] = useState(null);
  const { results, isLoading } = useBookSearch(query);
  const { addBook } = useLibraryStore();

  const handleAdd = async (book) => {
    setAddingId(book.googleBooksId);
    try {
      await addBook(book, 'to-read');
      toast.success(`"${book.title}" added to library!`);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAddingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-lg bg-[#1E1E1E] rounded-2xl border border-[#BDBDBD]/10 shadow-2xl"
        >
          <div className="flex items-center justify-between p-6 border-b border-[#BDBDBD]/10">
            <h2 className="text-xl font-bold">Add Book</h2>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#BDBDBD]" />
              <input
                type="text"
                placeholder="Search by title, author, ISBN..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[#121212] border border-[#BDBDBD]/20 rounded-xl text-white placeholder-[#BDBDBD]/50 focus:outline-none focus:border-[#8A2BE2] transition-colors"
                autoFocus
              />
              {isLoading && (
                <Loader2 size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A2BE2] animate-spin" />
              )}
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {results.map((book) => (
                <div
                  key={book.googleBooksId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#121212] hover:bg-[#2A2A2A] transition-colors"
                >
                  {book.coverImage ? (
                    <img src={book.coverImage} alt={book.title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-14 bg-[#1E1E1E] rounded-lg flex items-center justify-center flex-shrink-0">
                      <BookOpen size={20} className="text-[#BDBDBD]/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white line-clamp-2">{book.title}</p>
                    <p className="text-xs text-[#BDBDBD] mt-0.5">{book.author}</p>
                    {book.totalPages > 0 && (
                      <p className="text-xs text-[#BDBDBD]/60 mt-0.5">{book.totalPages} pages</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleAdd(book)}
                    disabled={addingId === book.googleBooksId}
                    className="flex-shrink-0 p-2 bg-[#8A2BE2] hover:bg-[#9D3DFF] text-white rounded-xl transition-colors disabled:opacity-50"
                  >
                    {addingId === book.googleBooksId ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                  </button>
                </div>
              ))}
              {!isLoading && query.length > 2 && results.length === 0 && (
                <p className="text-center text-[#BDBDBD] py-8 text-sm">No results found</p>
              )}
              {!query && (
                <p className="text-center text-[#BDBDBD]/50 py-8 text-sm">Type at least 3 characters to search</p>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
