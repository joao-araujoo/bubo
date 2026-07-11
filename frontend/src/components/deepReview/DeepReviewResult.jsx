import React from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Save,
  Sparkles,
  Target,
} from 'lucide-react';
import Button from '../ui/Button';
import ProgressBar from '../ui/ProgressBar';
import CognitiveDepthMeter from './CognitiveDepthMeter';

const criteriaLabels = {
  comprehension: 'Compreensão',
  specificity: 'Especificidade',
  connections: 'Conexões',
  reflection: 'Reflexão',
};

function GuidanceList({ items, tone = 'primary' }) {
  if (!items?.length) return null;
  const colorClass = tone === 'success'
    ? 'text-[rgb(var(--bubo-color-success))] bg-[rgb(var(--bubo-color-success)/0.1)]'
    : 'text-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary)/0.1)]';

  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
          <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full ${colorClass}`}>
            <Check size={12} aria-hidden="true" />
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DeepReviewResult({ result, onSaveProgress }) {
  if (!result) return null;

  const isApproved = result.state === 'APPROVED';
  const criteria = Object.entries(result.criteria || {});
  const meta = result.meta || {};
  const providerLabel = meta.provider === 'openai' ? 'OpenAI' : meta.provider === 'gemini' ? 'Gemini' : 'IA do Bubo';

  return (
    <article className={`w-full rounded-[var(--bubo-radius-xl)] border p-5 text-left shadow-[var(--bubo-shadow-sm)] sm:p-7 ${isApproved ? 'border-[rgb(var(--bubo-color-success)/0.3)] bg-[rgb(var(--bubo-color-success)/0.06)]' : 'border-[rgb(var(--bubo-color-warning)/0.35)] bg-[rgb(var(--bubo-color-warning)/0.07)]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {isApproved ? (
          <div className="flex items-center gap-2 font-extrabold text-[rgb(var(--bubo-color-success))]">
            <CheckCircle2 size={20} aria-hidden="true" /> Deep Review aprovada
          </div>
        ) : (
          <div className="flex items-center gap-2 font-extrabold text-[rgb(var(--bubo-color-warning))]">
            <BookOpen size={20} aria-hidden="true" /> Há espaço para aprofundar
          </div>
        )}
        <span className="rounded-full border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface)/0.86)] px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--bubo-color-text-muted))]">
          {providerLabel}
        </span>
      </div>

      <div className={`mt-6 grid gap-6 ${isApproved ? 'md:grid-cols-[9rem_1fr]' : ''}`}>
        {isApproved && (
          <div className="flex justify-center md:justify-start">
            <CognitiveDepthMeter score={result.cognitiveDepth} size={124} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-base font-semibold leading-7 text-[rgb(var(--bubo-color-text))]">{result.feedback}</p>
          {result.encouragement && <p className="mt-3 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{result.encouragement}</p>}
        </div>
      </div>

      {criteria.length > 0 && (
        <section className="mt-6 rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface)/0.78)] p-4 sm:p-5">
          <h4 className="text-xs font-extrabold uppercase tracking-[0.15em] text-[rgb(var(--bubo-color-primary))]">Dimensões avaliadas</h4>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {criteria.map(([key, score]) => (
              <ProgressBar key={key} label={criteriaLabels[key] || key} value={score} max={25} showValue />
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {result.strengths?.length > 0 && (
          <section className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-success)/0.22)] bg-[rgb(var(--bubo-color-surface)/0.72)] p-4">
            <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[rgb(var(--bubo-color-success))]">
              <Sparkles size={15} aria-hidden="true" /> Pontos fortes
            </h4>
            <GuidanceList items={result.strengths} tone="success" />
          </section>
        )}

        {result.nextSteps?.length > 0 && (
          <section className="rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-primary)/0.2)] bg-[rgb(var(--bubo-color-surface)/0.72)] p-4">
            <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[rgb(var(--bubo-color-primary))]">
              <Target size={15} aria-hidden="true" /> Próximos passos
            </h4>
            <GuidanceList items={result.nextSteps} />
          </section>
        )}
      </div>

      {result.socraticQuestion && (
        <section className="mt-4 rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-primary)/0.2)] bg-[rgb(var(--bubo-color-primary)/0.06)] p-4">
          <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[rgb(var(--bubo-color-primary))]">
            <HelpCircle size={15} aria-hidden="true" /> Pergunta socrática
          </h4>
          <p className="mt-2 text-sm leading-6">{result.socraticQuestion}</p>
        </section>
      )}

      {result.retentionPrompt && isApproved && (
        <section className="mt-4 rounded-[var(--bubo-radius-lg)] bg-[rgb(var(--bubo-color-surface-muted))] p-4">
          <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[rgb(var(--bubo-color-text-muted))]">
            <RefreshCw size={15} aria-hidden="true" /> Para revisar depois
          </h4>
          <p className="mt-2 text-sm leading-6">{result.retentionPrompt}</p>
        </section>
      )}

      {isApproved && (
        <Button className="mt-6 w-full sm:w-auto" onClick={onSaveProgress} leftIcon={<Save size={17} aria-hidden="true" />}>
          Salvar progresso
        </Button>
      )}
    </article>
  );
}
