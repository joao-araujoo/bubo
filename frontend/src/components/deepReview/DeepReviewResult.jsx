import React from 'react';
import { BookOpen, CheckCircle2, ChevronRight, HelpCircle, RefreshCw, Save, Sparkles, Target } from 'lucide-react';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';
import CognitiveDepthMeter from './CognitiveDepthMeter';

const criteriaLabels = {
  comprehension: 'Compreensão',
  specificity: 'Especificidade',
  connections: 'Conexões',
  reflection: 'Reflexão',
};

export default function DeepReviewResult({ result, onSaveProgress }) {
  if (!result) return null;

  const isApproved = result.state === 'APPROVED';
  const criteria = Object.entries(result.criteria || {});
  const meta = result.meta || {};

  return (
    <div className={`mt-5 w-full rounded-[var(--bubo-radius-lg)] border p-4 text-left ${isApproved ? 'border-[rgb(var(--bubo-color-success)/0.3)] bg-[rgb(var(--bubo-color-success)/0.08)]' : 'border-[rgb(var(--bubo-color-warning)/0.35)] bg-[rgb(var(--bubo-color-warning)/0.09)]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {isApproved ? (
          <div className="flex items-center gap-2 font-extrabold text-[rgb(var(--bubo-color-success))]">
            <CheckCircle2 size={18} aria-hidden="true" /> Aprovada
          </div>
        ) : (
          <div className="flex items-center gap-2 font-extrabold text-[rgb(var(--bubo-color-warning))]">
            <BookOpen size={18} aria-hidden="true" /> Vamos aprofundar
          </div>
        )}
        <span className="rounded-full bg-[rgb(var(--bubo-color-surface)/0.8)] px-2.5 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--bubo-color-text-muted))]">
          {meta.degraded ? 'fallback local' : meta.provider || 'Bubo'}
        </span>
      </div>

      {isApproved && (
        <div className="my-4 flex justify-center">
          <CognitiveDepthMeter score={result.cognitiveDepth} size={104} />
        </div>
      )}

      <p className="mt-3 text-sm leading-6">{result.feedback}</p>
      <p className="mt-3 text-sm italic text-[rgb(var(--bubo-color-text-muted))]">{result.encouragement}</p>

      {criteria.length > 0 && (
        <div className="mt-5 space-y-3 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface)/0.72)] p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[rgb(var(--bubo-color-primary))]">Dimensões avaliadas</p>
          {criteria.map(([key, score]) => (
            <ProgressBar
              key={key}
              label={criteriaLabels[key] || key}
              value={score}
              max={25}
              showValue
            />
          ))}
        </div>
      )}

      {result.strengths?.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[rgb(var(--bubo-color-success))]">
            <Sparkles size={14} aria-hidden="true" /> Pontos fortes
          </p>
          <ul className="mt-2 space-y-2 text-sm leading-5">
            {result.strengths.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      )}

      {result.nextSteps?.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[rgb(var(--bubo-color-primary))]">
            <Target size={14} aria-hidden="true" /> Próximos passos
          </p>
          <ul className="mt-2 space-y-2 text-sm leading-5">
            {result.nextSteps.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
      )}

      {result.socraticQuestion && (
        <div className="mt-4 rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-primary)/0.18)] bg-[rgb(var(--bubo-color-primary)/0.06)] p-3">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[rgb(var(--bubo-color-primary))]">
            <HelpCircle size={14} aria-hidden="true" /> Pergunta socrática
          </p>
          <p className="mt-2 text-sm leading-6">{result.socraticQuestion}</p>
        </div>
      )}

      {result.retentionPrompt && isApproved && (
        <div className="mt-4 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted))] p-3">
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[rgb(var(--bubo-color-text-muted))]">
            <RefreshCw size={14} aria-hidden="true" /> Para revisar depois
          </p>
          <p className="mt-2 text-sm leading-6">{result.retentionPrompt}</p>
        </div>
      )}

      {!isApproved && (
        <div className="mt-4 flex items-center gap-1 text-xs text-[rgb(var(--bubo-color-text-muted))]">
          <ChevronRight size={14} aria-hidden="true" /> Revise a síntese e envie novamente.
        </div>
      )}
      {isApproved && (
        <Button className="mt-5 w-full" onClick={onSaveProgress} leftIcon={<Save size={17} aria-hidden="true" />}>
          Salvar progresso
        </Button>
      )}
    </div>
  );
}
