import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileText,
  Lightbulb,
  Link2,
  RefreshCw,
  Send,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import BookCover from '../books/BookCover';
import BuboMascot from '../owl/BuboMascot';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';
import api from '../../services/api';
import { useCoachStore } from '../../stores/useCoachStore';
import { useLibraryStore } from '../../stores/useLibraryStore';
import DeepReviewResult from './DeepReviewResult';

const MIN_REVIEW_WORDS = 100;
const STEPS = [
  { key: 'context', label: 'Trecho' },
  { key: 'writing', label: 'Reflexão' },
  { key: 'review', label: 'Revisão' },
];

const getSubmissionError = (error) => {
  const code = error.response?.data?.code;
  const apiMessage = error.response?.data?.message;

  if (code === 'AI_NOT_CONFIGURED') {
    return {
      title: 'A IA ainda não está configurada',
      description: apiMessage || 'Configure uma chave OpenAI ou Gemini no servidor antes de validar.',
      retryable: false,
    };
  }
  if (code === 'AI_EMPTY_RESPONSE') {
    return {
      title: 'A IA respondeu sem uma avaliação completa',
      description: 'Sua escrita foi mantida. Tente novamente para receber a análise estruturada.',
      retryable: true,
    };
  }
  if (code === 'AI_PROVIDER_UNAVAILABLE' || error.response?.status === 503) {
    return {
      title: 'A IA está temporariamente indisponível',
      description: apiMessage || 'Sua escrita continua salva nesta tela. Aguarde alguns instantes e tente novamente.',
      retryable: true,
    };
  }
  if (!error.response) {
    return {
      title: 'Sem conexão com o Bubo',
      description: 'Verifique sua internet. Nada foi perdido e você pode tentar novamente quando a conexão voltar.',
      retryable: true,
    };
  }
  return {
    title: 'Não foi possível concluir a validação',
    description: apiMessage || 'Revise os dados do trecho e tente novamente. Sua reflexão foi preservada.',
    retryable: true,
  };
};

export default function DeepReviewModal({ isOpen, userBook, onClose, onCompleted }) {
  const [step, setStep] = useState('context');
  const [pageFrom, setPageFrom] = useState('');
  const [pageTo, setPageTo] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [mainInsight, setMainInsight] = useState('');
  const [result, setResult] = useState(null);
  const [submissionError, setSubmissionError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    fetchProfile,
    fetchStatus,
    isLoadingStatus,
    status: coachStatus,
  } = useCoachStore();
  const { updateBookPage } = useLibraryStore();

  const book = userBook?.bookId;
  const currentPage = Number(userBook?.currentPage || 0);
  const combinedReview = useMemo(
    () => `${reviewText.trim()}${mainInsight.trim() ? `\n\nInsight principal: ${mainInsight.trim()}` : ''}`,
    [mainInsight, reviewText],
  );
  const wordCount = combinedReview.split(/\s+/).filter(Boolean).length;
  const activeStepIndex = STEPS.findIndex((item) => item.key === step);

  useEffect(() => {
    if (!isOpen) return;
    setStep('context');
    setPageFrom(String(currentPage + 1));
    setPageTo('');
    setReviewText('');
    setMainInsight('');
    setResult(null);
    setSubmissionError(null);
    fetchStatus().catch(() => {});
  }, [currentPage, fetchStatus, isOpen, userBook]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, isSubmitting, onClose]);

  const validatePages = () => {
    const from = Number.parseInt(pageFrom, 10);
    const to = Number.parseInt(pageTo, 10);
    if (!from || from <= currentPage) return `A página inicial deve ser maior que ${currentPage}.`;
    if (!to || to < from) return 'A página final deve ser igual ou maior que a inicial.';
    if (book?.totalPages && to > book.totalPages) return `A página final não pode ultrapassar ${book.totalPages}.`;
    return null;
  };

  const validateWriting = () => {
    if (!reviewText.trim()) return 'Escreva sua síntese antes de continuar.';
    if (wordCount < MIN_REVIEW_WORDS) return `Escreva pelo menos ${MIN_REVIEW_WORDS} palavras. Ainda faltam ${MIN_REVIEW_WORDS - wordCount}.`;
    return null;
  };

  const goToWriting = () => {
    const error = validatePages();
    if (error) return toast.error(error);
    setStep('writing');
    return null;
  };

  const goToReview = () => {
    const error = validateWriting();
    if (error) return toast.error(error);
    setStep('review');
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validatePages() || validateWriting();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (!coachStatus?.connected) {
      setSubmissionError({
        title: 'A IA do Bubo não está conectada',
        description: 'Configure OpenAI ou Gemini no servidor. O Bubo não cria avaliações locais ou simuladas.',
        retryable: false,
      });
      return;
    }

    const from = Number.parseInt(pageFrom, 10);
    const to = Number.parseInt(pageTo, 10);
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const { data } = await api.post('/deep-review/submit', {
        userBookId: userBook._id,
        pageFrom: from,
        pageTo: to,
        reviewText: combinedReview,
      });
      const aiResult = data.aiResult;
      setResult(aiResult);
      setStep('result');

      if (aiResult.state === 'APPROVED') {
        updateBookPage(userBook._id, to);
        fetchProfile().catch(() => {});
        toast.success(`Deep Review aprovada com ${aiResult.cognitiveDepth} de profundidade.`);
        Promise.resolve(onCompleted?.({
          review: data.review,
          aiResult,
          userBookId: userBook._id,
          currentPage: to,
        })).catch(() => {});
      }
    } catch (error) {
      setSubmissionError(getSubmissionError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveProgress = () => {
    toast.success('Progresso salvo no seu acervo.');
    onClose();
  };

  if (!userBook) return null;

  const renderContextStep = () => (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="grid gap-5 rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted))] p-5 sm:grid-cols-[7rem_1fr] sm:p-6">
        <div className="mx-auto w-24 sm:mx-0 sm:w-28">
          <BookCover title={book?.title} author={book?.author} src={book?.coverImage} />
        </div>
        <div className="min-w-0 self-center text-center sm:text-left">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgb(var(--bubo-color-primary))]">Trecho que você acabou de ler</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.02em]">{book?.title || 'Livro sem título'}</h3>
          <p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{book?.author || 'Autor não informado'}</p>
          <p className="mt-4 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
            Sua página atual é {currentPage}. Informe somente o intervalo novo que será validado nesta revisão.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Página inicial" type="number" min={currentPage + 1} max={book?.totalPages || undefined} value={pageFrom} onChange={(event) => setPageFrom(event.target.value)} required />
        <Input label="Página final" type="number" min={Number(pageFrom) || currentPage + 1} max={book?.totalPages || undefined} value={pageTo} onChange={(event) => setPageTo(event.target.value)} required description={book?.totalPages ? `O livro possui ${book.totalPages} páginas.` : 'O total de páginas ainda não foi confirmado.'} />
      </div>

      <div className="flex justify-end">
        <Button onClick={goToWriting} rightIcon={<ArrowRight size={17} aria-hidden="true" />}>
          Começar reflexão
        </Button>
      </div>
    </div>
  );

  const renderWritingStep = () => (
    <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[1fr_18rem]">
      <div className="min-w-0">
        <Textarea
          label="Sua síntese reflexiva"
          value={reviewText}
          onChange={(event) => setReviewText(event.target.value)}
          rows={16}
          maxLength={12000}
          required
          className="min-h-[48vh] resize-y text-base leading-7 sm:min-h-[31rem]"
          placeholder="Escreva com suas palavras o que aconteceu, quais ideias importam, que relações você percebeu e o que ainda ficou em aberto."
          description="Seu texto não precisa ser acadêmico. Ele precisa tornar visível como você compreendeu e conectou o trecho."
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] px-4 py-3 text-sm">
          <span className={wordCount >= MIN_REVIEW_WORDS ? 'font-bold text-[rgb(var(--bubo-color-success))]' : 'text-[rgb(var(--bubo-color-text-muted))]'}>
            {wordCount} palavras
          </span>
          <span className="text-[rgb(var(--bubo-color-text-muted))]">
            {wordCount >= MIN_REVIEW_WORDS ? 'Pronto para revisar' : `Faltam ${MIN_REVIEW_WORDS - wordCount}`}
          </span>
        </div>
      </div>

      <aside className="space-y-3 lg:pt-7">
        <div className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold"><FileText size={17} className="text-[rgb(var(--bubo-color-primary))]" aria-hidden="true" /> Compreensão</p>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Explique o que mudou, foi revelado ou entrou em conflito.</p>
        </div>
        <div className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold"><Link2 size={17} className="text-[rgb(var(--bubo-color-primary))]" aria-hidden="true" /> Conexões</p>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Relacione o trecho a outra ideia, experiência ou parte do livro.</p>
        </div>
        <div className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4">
          <p className="flex items-center gap-2 text-sm font-extrabold"><Lightbulb size={17} className="text-[rgb(var(--bubo-color-primary))]" aria-hidden="true" /> Reflexão</p>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Mostre o que você concluiu, questionou ou pretende lembrar.</p>
        </div>
      </aside>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between lg:col-span-2">
        <Button variant="secondary" onClick={() => setStep('context')} leftIcon={<ArrowLeft size={17} aria-hidden="true" />}>Voltar</Button>
        <Button onClick={goToReview} rightIcon={<ArrowRight size={17} aria-hidden="true" />} disabled={!reviewText.trim()}>Revisar antes de enviar</Button>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <div className="rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[rgb(var(--bubo-color-primary))]">Confira antes de validar</p>
            <h3 className="mt-1 text-xl font-black">Páginas {pageFrom}–{pageTo}</h3>
          </div>
          <CheckCircle2 size={24} className="text-[rgb(var(--bubo-color-success))]" aria-hidden="true" />
        </div>
        <div className="mt-5 max-h-[38vh] overflow-y-auto whitespace-pre-wrap rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-4 text-sm leading-7 sm:max-h-[24rem]">
          {reviewText}
        </div>
      </div>

      <Textarea
        label="Insight principal"
        value={mainInsight}
        onChange={(event) => setMainInsight(event.target.value)}
        rows={4}
        maxLength={700}
        placeholder="Qual ideia desse trecho você quer lembrar daqui a um mês?"
        description="Opcional. Essa frase ajuda o Bubo a construir futuras revisões de retenção."
      />

      {!isLoadingStatus && !coachStatus?.connected && (
        <div className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-warning)/0.35)] bg-[rgb(var(--bubo-color-warning)/0.08)] p-4">
          <p className="flex items-center gap-2 font-extrabold text-[rgb(var(--bubo-color-warning))]"><WifiOff size={18} aria-hidden="true" /> IA não configurada</p>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Adicione uma chave OpenAI ou Gemini no backend. O Bubo não usa avaliação local ou nota simulada.</p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => fetchStatus().catch(() => {})} leftIcon={<RefreshCw size={15} aria-hidden="true" />}>Verificar novamente</Button>
        </div>
      )}

      {submissionError && (
        <div className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-danger)/0.28)] bg-[rgb(var(--bubo-color-danger)/0.07)] p-4" role="alert">
          <p className="flex items-center gap-2 font-extrabold text-[rgb(var(--bubo-color-danger))]"><AlertCircle size={18} aria-hidden="true" /> {submissionError.title}</p>
          <p className="mt-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{submissionError.description}</p>
          {submissionError.retryable && (
            <Button className="mt-3" size="sm" variant="secondary" onClick={handleSubmit} leftIcon={<RefreshCw size={15} aria-hidden="true" />}>Tentar novamente</Button>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="secondary" onClick={() => setStep('writing')} disabled={isSubmitting} leftIcon={<ArrowLeft size={17} aria-hidden="true" />}>Editar reflexão</Button>
        <Button onClick={handleSubmit} isLoading={isSubmitting} disabled={!coachStatus?.connected || isLoadingStatus} leftIcon={<Send size={17} aria-hidden="true" />}>
          Validar com a IA do Bubo
        </Button>
      </div>
    </div>
  );

  const renderResultStep = () => (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-5 flex flex-col items-center text-center">
        <BuboMascot state={result?.state === 'APPROVED' ? 'approved' : 'guiding'} size={104} />
        <h3 className="mt-3 text-xl font-black">Análise concluída</h3>
        <p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">O resultado aparece separado da escrita para você ler com calma.</p>
      </div>
      <DeepReviewResult result={result} onSaveProgress={handleSaveProgress} />
      {result?.state !== 'APPROVED' && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={() => setStep('writing')} leftIcon={<ArrowLeft size={17} aria-hidden="true" />}>Aprofundar minha reflexão</Button>
        </div>
      )}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-stretch justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => event.target === event.currentTarget && !isSubmitting && onClose()}
        >
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.99 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deep-review-title"
            className="flex h-full w-full flex-col overflow-hidden bg-[rgb(var(--bubo-color-surface))] shadow-[var(--bubo-shadow-lg)] sm:max-h-[94vh] sm:max-w-7xl sm:rounded-[1.5rem] sm:border sm:border-[rgb(var(--bubo-color-border))]"
          >
            <header className="shrink-0 border-b border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface)/0.96)] px-4 py-4 backdrop-blur-xl sm:px-7">
              <div className="flex items-center gap-3">
                <BuboMascot state={isSubmitting ? 'thinking' : 'idle'} size={54} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-[rgb(var(--bubo-color-primary))]"><Sparkles size={13} aria-hidden="true" /> IA socrática</p>
                  <h2 id="deep-review-title" className="truncate text-xl font-black tracking-[-0.025em] sm:text-2xl">Deep Review</h2>
                </div>
                <button type="button" onClick={onClose} disabled={isSubmitting} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--bubo-color-border))] text-[rgb(var(--bubo-color-text-muted))] transition hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))] disabled:opacity-50" aria-label="Fechar Deep Review">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              {step !== 'result' && (
                <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Etapas da Deep Review">
                  {STEPS.map((item, index) => {
                    const isCurrent = step === item.key;
                    const isComplete = activeStepIndex > index;
                    return (
                      <li key={item.key} className={`rounded-full px-2 py-2 text-center text-[0.7rem] font-extrabold sm:text-xs ${isCurrent ? 'bg-[rgb(var(--bubo-color-primary))] text-white' : isComplete ? 'bg-[rgb(var(--bubo-color-primary)/0.12)] text-[rgb(var(--bubo-color-primary))]' : 'bg-[rgb(var(--bubo-color-surface-muted))] text-[rgb(var(--bubo-color-text-muted))]'}`} aria-current={isCurrent ? 'step' : undefined}>
                        {index + 1}. {item.label}
                      </li>
                    );
                  })}
                </ol>
              )}
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
              {step === 'context' && renderContextStep()}
              {step === 'writing' && renderWritingStep()}
              {step === 'review' && renderReviewStep()}
              {step === 'result' && renderResultStep()}
            </main>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
