import React, { useMemo, useState } from 'react';
import { BookOpen, Sparkles, Trash2 } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

const focusLabels = {
  'not-informed': 'Concentração não informada',
  low: 'Concentração baixa',
  medium: 'Concentração média',
  high: 'Concentração alta',
};

export const formatReadingDate = (value) => {
  if (!value) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
};

export const formatReadingDuration = (minutes) => {
  const total = Number(minutes) || 0;
  if (total <= 0) return 'Duração não informada';
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const remaining = total % 60;
  return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
};

export default function BookReadingTimeline({ reviews = [], sessions = [], onDeleteSession }) {
  const [filter, setFilter] = useState('all');
  const timeline = useMemo(() => {
    const sessionItems = sessions.map((session) => ({
      ...session,
      timelineType: 'session',
      timelineDate: session.readAt || session.createdAt,
    }));
    const reviewItems = reviews.map((review) => ({
      ...review,
      timelineType: 'review',
      timelineDate: review.createdAt,
    }));
    return [...sessionItems, ...reviewItems]
      .filter((item) => filter === 'all' || item.timelineType === filter)
      .sort((a, b) => new Date(b.timelineDate) - new Date(a.timelineDate));
  }, [filter, reviews, sessions]);

  return (
    <section className="rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-5 shadow-[var(--bubo-shadow-sm)] sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[rgb(var(--bubo-color-primary))]">Linha do tempo</p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">Sua trajetória neste livro</h2>
          <p className="mt-1 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">Sessões e Deep Reviews aparecem juntas para preservar o contexto da leitura.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filtrar histórico">
          {[
            ['all', 'Tudo'],
            ['session', 'Sessões'],
            ['review', 'Deep Reviews'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))] ${filter === value ? 'border-[rgb(var(--bubo-color-primary))] bg-[rgb(var(--bubo-color-primary))] text-white' : 'border-[rgb(var(--bubo-color-border))] text-[rgb(var(--bubo-color-text-muted))] hover:text-[rgb(var(--bubo-color-text))]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {timeline.length === 0 ? (
        <div className="mt-6 rounded-[var(--bubo-radius-xl)] border border-dashed border-[rgb(var(--bubo-color-border))] p-8 text-center">
          <BookOpen size={28} className="mx-auto text-[rgb(var(--bubo-color-primary))]" aria-hidden="true" />
          <h3 className="mt-3 font-black">Nenhum registro neste filtro</h3>
          <p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">Registre uma sessão ou faça uma Deep Review para construir seu histórico.</p>
        </div>
      ) : (
        <div className="relative mt-7 space-y-4 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-[rgb(var(--bubo-color-border))]">
          {timeline.map((item) => item.timelineType === 'session' ? (
            <SessionEntry key={`session-${item._id}`} session={item} onDelete={() => onDeleteSession?.(item)} />
          ) : (
            <ReviewEntry key={`review-${item._id}`} review={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function SessionEntry({ onDelete, session }) {
  return (
    <article className="relative ml-10 rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4 sm:p-5">
      <span className="absolute -left-[2.55rem] top-4 grid h-10 w-10 place-items-center rounded-full border-4 border-[rgb(var(--bubo-color-surface))] bg-[rgb(var(--bubo-color-primary))] text-white"><BookOpen size={16} aria-hidden="true" /></span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.11em] text-[rgb(var(--bubo-color-primary))]">Sessão de leitura</p>
          <h3 className="mt-1 font-black">Páginas {session.pageFrom}–{session.pageTo}</h3>
          <p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{formatReadingDate(session.readAt)} · {session.pagesRead} páginas · {formatReadingDuration(session.durationMinutes)}</p>
        </div>
        <button type="button" onClick={onDelete} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[rgb(var(--bubo-color-text-muted))] transition hover:bg-[rgb(var(--bubo-color-danger)/0.08)] hover:text-[rgb(var(--bubo-color-danger))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))]" aria-label="Remover sessão">
          <Trash2 size={17} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-3 text-sm font-semibold text-[rgb(var(--bubo-color-text-muted))]">{focusLabels[session.focus] || focusLabels['not-informed']}</p>
      {session.note && <p className="mt-3 whitespace-pre-wrap rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-surface-muted)/0.65)] p-4 text-sm leading-6">{session.note}</p>}
    </article>
  );
}

function ReviewEntry({ review }) {
  const approved = review.status === 'approved';
  return (
    <article className="relative ml-10 rounded-[var(--bubo-radius-xl)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4 sm:p-5">
      <span className="absolute -left-[2.55rem] top-4 grid h-10 w-10 place-items-center rounded-full border-4 border-[rgb(var(--bubo-color-surface))] bg-[rgb(var(--bubo-color-accent))] text-white"><Sparkles size={16} aria-hidden="true" /></span>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.11em] text-[rgb(var(--bubo-color-primary))]">Deep Review</p>
          <h3 className="mt-1 font-black">Páginas {review.pageFrom}–{review.pageTo}</h3>
          <p className="mt-1 text-sm text-[rgb(var(--bubo-color-text-muted))]">{formatReadingDate(review.createdAt)} · {formatNumber(review.wordCount || 0)} palavras</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${approved ? 'bg-[rgb(var(--bubo-color-success)/0.1)] text-[rgb(var(--bubo-color-success))]' : 'bg-[rgb(var(--bubo-color-warning)/0.12)] text-[rgb(var(--bubo-color-warning))]'}`}>
          {approved ? `${review.cognitiveDepth}/100` : 'Em orientação'}
        </span>
      </div>
      <p className="mt-4 line-clamp-5 whitespace-pre-wrap text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{review.reviewText}</p>
      {review.aiResponse?.summary && <p className="mt-3 rounded-[var(--bubo-radius-md)] bg-[rgb(var(--bubo-color-primary)/0.06)] p-4 text-sm leading-6">{review.aiResponse.summary}</p>}
    </article>
  );
}
