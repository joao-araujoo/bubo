import React, { useEffect, useId } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  children,
  description,
  footer,
  isOpen,
  onClose,
  size = 'md',
  title,
}) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[1.5rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] shadow-[var(--bubo-shadow-lg)] sm:rounded-[1.5rem] ${sizeClasses[size] || sizeClasses.md}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[rgb(var(--bubo-color-border))] px-5 py-5 sm:px-6">
          <div>
            <h2 id={titleId} className="text-xl font-black tracking-[-0.02em]">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--bubo-color-border))] text-[rgb(var(--bubo-color-text-muted))] transition hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))]"
            aria-label="Fechar"
          >
            <X size={19} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && <footer className="border-t border-[rgb(var(--bubo-color-border))] px-5 py-4 sm:px-6">{footer}</footer>}
      </section>
    </div>
  );
}
