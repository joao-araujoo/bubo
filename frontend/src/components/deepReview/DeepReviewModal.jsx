import React, { useState, useEffect } from 'react';
import { X, Send, Save, BookOpen, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BuboMascot from '../owl/BuboMascot';
import CognitiveDepthMeter from './CognitiveDepthMeter';
import api from '../../services/api';
import { useLibraryStore } from '../../stores/useLibraryStore';
import toast from 'react-hot-toast';

export default function DeepReviewModal({ isOpen, userBook, onClose }) {
  const [owlState, setOwlState] = useState('idle');
  const [newPage, setNewPage] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateBookPage } = useLibraryStore();

  const book = userBook?.bookId;
  const currentPage = userBook?.currentPage || 0;
  const wordCount = reviewText.trim().split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    if (isOpen) {
      setOwlState('idle');
      setNewPage('');
      setReviewText('');
      setResult(null);
    }
  }, [isOpen, userBook]);

  const handleSubmit = async () => {
    const pageNum = parseInt(newPage);
    if (!pageNum || pageNum <= currentPage) {
      toast.error(`Page must be greater than current page (${currentPage})`);
      return;
    }
    if (wordCount < 10) {
      toast.error('Please write a more detailed synthesis');
      return;
    }
    setIsSubmitting(true);
    setOwlState('thinking');
    setResult(null);
    try {
      const { data } = await api.post('/deep-review/submit', {
        userBookId: userBook._id,
        pageFrom: currentPage,
        pageTo: pageNum,
        reviewText
      });
      const aiResult = data.aiResult;
      setResult(aiResult);
      if (aiResult.state === 'APPROVED') {
        setOwlState('approved');
        updateBookPage(userBook._id, pageNum);
        toast.success(`Approved! ${aiResult.cognitiveDepth}% Cognitive Depth`);
      } else {
        setOwlState('guiding');
        toast('Keep thinking deeper — Bubo believes in you!', { icon: '🦉' });
      }
    } catch (err) {
      setOwlState('idle');
      toast.error(err.response?.data?.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProgress = () => {
    toast.success('Progress saved!');
    onClose();
  };

  if (!isOpen || !userBook) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-4xl bg-[#1E1E1E] rounded-2xl border border-[#BDBDBD]/10 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#BDBDBD]/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              <BookOpen size={20} className="text-[#8A2BE2]" />
              <div>
                <h2 className="text-lg font-bold text-white">Deep Review</h2>
                <p className="text-sm text-[#BDBDBD]">{book?.title}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left Panel */}
            <div className="flex-1 p-6 overflow-y-auto border-r border-[#BDBDBD]/10 space-y-5">
              <div className="flex items-center gap-3 p-4 bg-[#121212] rounded-xl">
                {book?.coverImage && (
                  <img src={book.coverImage} alt={book.title} className="w-12 h-16 object-cover rounded-lg" />
                )}
                <div>
                  <p className="font-medium text-white text-sm">{book?.title}</p>
                  <p className="text-xs text-[#BDBDBD]">{book?.author}</p>
                  <p className="text-xs text-[#00FFFF] mt-1">Currently on page {currentPage}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#BDBDBD] mb-2">
                  New Page Number
                </label>
                <input
                  type="number"
                  placeholder={`Enter page (must be > ${currentPage})`}
                  value={newPage}
                  onChange={(e) => setNewPage(e.target.value)}
                  min={currentPage + 1}
                  max={book?.totalPages || 9999}
                  className="w-full px-4 py-3 bg-[#121212] border border-[#BDBDBD]/20 rounded-xl text-white placeholder-[#BDBDBD]/40 focus:outline-none focus:border-[#8A2BE2] transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#BDBDBD] mb-2">
                  Your Synthesis
                </label>
                <textarea
                  placeholder="Write your deep reflection on what you've read... What themes emerged? What connections did you make? What questions arose? How does this change your thinking? (minimum 100 words recommended)"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 bg-[#121212] border border-[#BDBDBD]/20 rounded-xl text-white placeholder-[#BDBDBD]/40 focus:outline-none focus:border-[#8A2BE2] transition-colors resize-none text-sm"
                />
                <div className="flex justify-between mt-1">
                  <span className={`text-xs ${wordCount >= 100 ? 'text-[#00FFFF]' : 'text-[#BDBDBD]'}`}>
                    {wordCount} words {wordCount < 100 ? `(${100 - wordCount} more for best results)` : '✓'}
                  </span>
                  <span className="text-xs text-[#BDBDBD]">{reviewText.length} chars</span>
                </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !newPage || !reviewText}
                className="w-full py-3 px-6 bg-[#8A2BE2] hover:bg-[#9D3DFF] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>Bubo is thinking...</>
                ) : (
                  <>
                    <Send size={16} />
                    Submit for Validation
                  </>
                )}
              </button>

              {result?.state === 'APPROVED' && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={handleSaveProgress}
                  className="w-full py-3 px-6 bg-[#00FFFF] hover:bg-[#00E5E5] text-[#121212] rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  Save Progress
                </motion.button>
              )}
            </div>

            {/* Right Panel */}
            <div className="w-80 p-6 flex flex-col items-center gap-6 overflow-y-auto">
              <BuboMascot state={owlState} size={140} />

              {owlState === 'idle' && (
                <div className="text-center">
                  <p className="text-[#BDBDBD] text-sm">Write your synthesis and submit for validation</p>
                </div>
              )}

              {owlState === 'thinking' && (
                <div className="text-center space-y-2">
                  <p className="text-[#8A2BE2] font-medium text-sm">Analyzing your reflection...</p>
                  <p className="text-[#BDBDBD] text-xs">Bubo is evaluating your cognitive depth</p>
                </div>
              )}

              <AnimatePresence>
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full space-y-4"
                  >
                    {result.state === 'APPROVED' ? (
                      <div className="p-4 bg-[#00FFFF]/10 border border-[#00FFFF]/30 rounded-xl space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[#00FFFF] font-bold text-sm">✓ APPROVED</span>
                        </div>
                        <CognitiveDepthMeter score={result.cognitiveDepth} size={100} />
                        <p className="text-sm text-white">{result.feedback}</p>
                        <p className="text-xs text-[#00FFFF] italic">{result.encouragement}</p>
                      </div>
                    ) : (
                      <div className="p-4 bg-[#FF9800]/10 border border-[#FF9800]/30 rounded-xl space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[#FF9800] font-bold text-sm">🦉 GUIDING</span>
                        </div>
                        <p className="text-sm text-white">{result.feedback}</p>
                        <p className="text-xs text-[#FF9800] italic">{result.encouragement}</p>
                        <div className="flex items-center gap-1 text-xs text-[#BDBDBD]">
                          <ChevronRight size={12} />
                          <span>Revise your synthesis above and try again</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
