import React, { useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import StatusBadge from './StatusBadge';
import { useLibraryStore } from '../../stores/useLibraryStore';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['reading', 'to-read', 'read', 'abandoned'];

export default function BookCard({ userBook, onDeepReview }) {
  const { bookId: book, status, currentPage, _id: userBookId } = userBook;
  const { updateBookStatus } = useLibraryStore();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const progress = book?.totalPages > 0 ? Math.min(100, (currentPage / book.totalPages) * 100) : 0;

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    setShowStatusMenu(false);
    try {
      await updateBookStatus(userBookId, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-[#1E1E1E] border border-[#BDBDBD]/10 overflow-hidden hover:border-[#8A2BE2]/30 transition-all duration-300 group"
    >
      {/* Cover Image */}
      <div className="relative h-48 bg-[#121212] flex items-center justify-center overflow-hidden">
        {book?.coverImage ? (
          <img src={book.coverImage} alt={book.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#BDBDBD]/40">
            <BookOpen size={48} />
            <span className="text-xs">No Cover</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1E1E1E] to-transparent opacity-60" />
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-white line-clamp-2 text-sm leading-tight">{book?.title || 'Unknown Title'}</h3>
          <p className="text-[#BDBDBD] text-xs mt-1">{book?.author || 'Unknown Author'}</p>
        </div>

        {/* Status Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            disabled={updatingStatus}
            className="flex items-center gap-2 w-full justify-between"
          >
            <StatusBadge status={status} />
            <ChevronDown size={14} className="text-[#BDBDBD]" />
          </button>
          {showStatusMenu && (
            <div className="absolute top-full left-0 mt-1 w-full z-20 bg-[#2A2A2A] rounded-xl border border-[#BDBDBD]/10 overflow-hidden shadow-xl">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#8A2BE2]/20 transition-colors"
                >
                  <StatusBadge status={s} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {book?.totalPages > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#BDBDBD]">
              <span>Page {currentPage}</span>
              <span>{book.totalPages} pages</span>
            </div>
            <div className="h-1.5 bg-[#121212] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-[#00FFFF] rounded-full"
              />
            </div>
            <p className="text-xs text-[#BDBDBD] text-right">{Math.round(progress)}%</p>
          </div>
        )}

        {/* Deep Review Button */}
        <button
          onClick={() => onDeepReview(userBook)}
          className="w-full py-2 px-4 bg-[#8A2BE2] hover:bg-[#9D3DFF] text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <BookOpen size={14} />
          Deep Review
        </button>
      </div>
    </motion.div>
  );
}
