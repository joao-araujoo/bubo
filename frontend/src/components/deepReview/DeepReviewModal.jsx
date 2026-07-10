import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookOpen, CheckCircle2, ChevronRight, Save, Send, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import BookCover from '../books/BookCover';
import BuboMascot from '../owl/BuboMascot';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';
import api from '../../services/api';
import { useLibraryStore } from '../../stores/useLibraryStore';
import CognitiveDepthMeter from './CognitiveDepthMeter';

const MIN_REVIEW_WORDS = 100;

export default function DeepReviewModal({ isOpen, userBook, onClose, onCompleted }) {
  const [owlState, setOwlState] = useState('idle');
  const [pageFrom, setPageFrom] = useState('');
  const [pageTo, setPageTo] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [mainInsight, setMainInsight] = useState('');
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateBookPage } = useLibraryStore();

  const book = userBook?.bookId;
  const currentPage = Number(userBook?.currentPage || 0);
  const combinedReview = useMemo(
    () => `${reviewText.trim()}${mainInsight.trim() ? `\n\nInsight principal: ${mainInsight.trim()}` : ''}`,
    [mainInsight, reviewText],
  );
  const wordCount = combinedReview.split(/\s+/).filter(Boolean).length;

  useEffect(() => {
    if (!isOpen) return;
    setOwlState('idle');
    setPageFrom(String(currentPage + 1));
    setPageTo('');
    setReviewText('');
    setMainInsight('');
    setResult(null);
  }, [currentPage, isOpen, userBook]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, isSubmitting, onClose]);

  const validate = () => {
    const from = Number.parseInt(pageFrom, 10);
    const to = Number.parseInt(pageTo, 10);
    if (!from || from <= currentPage) return `A página inicial deve ser maior que ${currentPage}.`;
    if (!to || to < from) return 'A página final deve ser igual ou maior que a inicial.';
    if (book?.totalPages && to > book.totalPages) return `A página final não pode ultrapassar ${book.totalPages}.`;
    if (wordCount < MIN_REVIEW_WORDS) return `Escreva pelo menos ${MIN_REVIEW_WORDS} palavras para uma avaliação confiável.`;
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const from = Number.parseInt(pageFrom, 10);
    const to = Number.parseInt(pageTo, 10);
    setIsSubmitting(true);
    setOwlState('thinking');
    setResult(null);

    try {
      const { data } = await api.post('/deep-review/submit', {
        userBookId: userBook._id,
        pageFrom: from,
        pageTo: to,
        reviewText: combinedReview,
      });
      const aiResult = data.aiResult;
      setResult(aiResult);

      if (aiResult.state === 'APPROVED') {
        setOwlState('approved');
        updateBookPage(userBook._id, to);
        toast.success(`Deep Review aprovada com ${aiResult.cognitiveDepth}% de profundidade.`);
        Promise.resolve(onCompleted?.({
          review: data.review,
          aiResult,
          userBookId: userBook._id,
          currentPage: to,
        })).catch(() => {});
      } else {
        setOwlState('guiding');
        toast('O Bubo encontrou caminhos para aprofundar sua reflexão.', { icon: '🦉' });
      }
    } catch (error) {
      setOwlState('idle');
      toast.error(error.response?.data?.message || 'Não foi possível validar a Deep Review.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProgress = () => {
    toast.success('Progresso salvo no seu acervo.');
    onClose();
  };

  if (!userBook) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => event.target === event.currentTarget && !isSubmitting && onClose()}
        >
          <motion.section
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deep-review-title"
            className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[1.5rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] shadow-[var(--bubo-shadow-lg)] sm:rounded-[1.5rem]"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[rgb(var(--bubo-color-border))] px-5 py-5 sm:px-7">
              <div>
                <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.2em] text-[rgb(var(--bubo-color-primary))]"><Sparkles size={14} /> IA socrática</p>
                <h2 id="deep-review-title" className="mt-1 text-2xl font-black tracking-[-0.025em]">Deep Review</h2>
                <p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">O Bubo valida síntese, conexões e especificidade antes de salvar seu progresso.</p>
              </div>
              <button type="button" onClick={onClose} disabled={isSubmitting} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--bubo-color-border))] text-[rgb(var(--bubo-color-text-muted))] transition hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))] disabled:opacity-50" aria-label="Fechar Deep Review"><X size={20} /></button>
            </header>

            <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_20rem] lg:overflow-hidden">
              <div className="space-y-5 p-5 sm:p-7 lg:overflow-y-auto">
                <div className="flex items-center gap-4 rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted))] p-3">
                  <div className="w-14 shrink-0"><BookCover title={book?.title} author={book?.author} src={book?.coverImage} /></div>
                  <div className="min-w-0"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgb(var(--bubo-color-primary))]">Livro selecionado</p><h3 className="mt-1 truncate font-extrabold">{book?.title || 'Livro sem título'}</h3><p className="truncate text-sm text-[rgb(var(--bubo-color-text-muted))]">{book?.author || 'Autor não informado'} · página atual {currentPage}</p></div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Página inicial" type="number" min={currentPage + 1} max={book?.totalPages || undefined} value={pageFrom} onChange={(event) => setPageFrom(event.target.value)} required />
                  <Input label="Página final" type="number" min={Number(pageFrom) || currentPage + 1} max={book?.totalPages || undefined} value={pageTo} onChange={(event) => setPageTo(event.target.value)} required />
                </div>

                <Textarea label="Síntese reflexiva" value={reviewText} onChange={(event) => setReviewText(event.target.value)} rows={8} required placeholder="Explique o que aconteceu, quais ideias importam, quais conexões você fez e o que ficou em aberto." description="Evite apenas recontar o enredo. Relacione acontecimentos, temas e interpretações." />
                <Textarea label="Insight principal" value={mainInsight} onChange={(event) => setMainInsight(event.target.value)} rows={3} placeholder="Qual ideia desse trecho você quer lembrar daqui a um mês?" />

                <div className="flex flex-col gap-3 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className={wordCount >= MIN_REVIEW_WORDS ? 'font-bold text-[rgb(var(--bubo-color-success))]' : 'text-[rgb(var(--bubo-color-text-muted))]'}>{wordCount} palavras {wordCount >= MIN_REVIEW_WORDS ? '· pronto para validar' : `· faltam ${MIN_REVIEW_WORDS - wordCount}`}</span>
                  <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!pageTo || !reviewText.trim()} leftIcon={<Send size={17} />}>Validar com o Bubo</Button>
                </div>
              </div>

              <aside className="border-t border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted))] p-5 sm:p-7 lg:overflow-y-auto lg:border-l lg:border-t-0">
                <div className="mx-auto flex max-w-xs flex-col items-center text-center">
                  <BuboMascot state={owlState} size={132} />
                  {owlState === 'idle' && <><h3 className="mt-3 font-extrabold">Escreva com suas palavras</h3><p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">O objetivo não é parecer acadêmico, mas demonstrar que você conectou as ideias do trecho.</p></>}
                  {owlState === 'thinking' && <><h3 className="mt-3 font-extrabold text-[rgb(var(--bubo-color-primary))]">Analisando sua reflexão…</h3><p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">O Bubo está avaliando especificidade, relações e profundidade cognitiva.</p></>}

                  {result && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`mt-5 w-full rounded-[var(--bubo-radius-lg)] border p-4 text-left ${result.state === 'APPROVED' ? 'border-[rgb(var(--bubo-color-success)/0.3)] bg-[rgb(var(--bubo-color-success)/0.08)]' : 'border-[rgb(var(--bubo-color-warning)/0.35)] bg-[rgb(var(--bubo-color-warning)/0.09)]'}`}>
                      {result.state === 'APPROVED' ? (
                        <>
                          <div className="flex items-center gap-2 font-extrabold text-[rgb(var(--bubo-color-success))]"><CheckCircle2 size={18} /> Aprovada</div>
                          <div className="my-4 flex justify-center"><CognitiveDepthMeter score={result.cognitiveDepth} size={104} /></div>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 font-extrabold text-[rgb(var(--bubo-color-warning))]"><BookOpen size={18} /> Vamos aprofundar</div>
                      )}
                      <p className="mt-3 text-sm leading-6">{result.feedback}</p>
                      <p className="mt-3 text-sm italic text-[rgb(var(--bubo-color-text-muted))]">{result.encouragement}</p>
                      {result.state !== 'APPROVED' && <div className="mt-4 flex items-center gap-1 text-xs text-[rgb(var(--bubo-color-text-muted))]"><ChevronRight size={14} /> Revise a síntese e envie novamente.</div>}
                      {result.state === 'APPROVED' && <Button className="mt-5 w-full" onClick={handleSaveProgress} leftIcon={<Save size={17} />}>Salvar progresso</Button>}
                    </motion.div>
                  )}
                </div>
              </aside>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
