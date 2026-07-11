import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function Modal({
  children,
  closeOnBackdrop = true,
  closeOnEscape = true,
  description,
  footer,
  isOpen,
  onClose,
  size = 'md',
  title,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusDialog = window.requestAnimationFrame(() => {
      const firstFocusable = dialogRef.current?.querySelector(focusableSelector);
      (firstFocusable || dialogRef.current)?.focus();
    });

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(focusableSelector)]
        .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusDialog);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [closeOnEscape, isOpen, onClose]);

  if (typeof document === 'undefined') return null;

  const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-xl',
    lg: 'sm:max-w-3xl',
    xl: 'sm:max-w-5xl',
    full: 'sm:max-w-[min(96rem,calc(100vw-2rem))]',
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-[3px] sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
          }}
        >
          <motion.section
            ref={dialogRef}
            initial={{ opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            className={`flex max-h-[94dvh] w-full flex-col overflow-hidden rounded-t-[1.5rem] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] shadow-[var(--bubo-shadow-lg)] outline-none sm:max-h-[92vh] sm:rounded-[1.5rem] ${sizeClasses[size] || sizeClasses.md}`}
          >
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface)/0.96)] px-5 py-4 backdrop-blur-xl sm:px-6 sm:py-5">
              <div className="min-w-0">
                <h2 id={titleId} className="text-xl font-black tracking-[-0.025em] text-[rgb(var(--bubo-color-text))] sm:text-2xl">{title}</h2>
                {description && (
                  <p id={descriptionId} className="mt-1 max-w-2xl text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] text-[rgb(var(--bubo-color-text-muted))] transition hover:border-[rgb(var(--bubo-color-primary)/0.35)] hover:bg-[rgb(var(--bubo-color-surface-muted))] hover:text-[rgb(var(--bubo-color-text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--bubo-color-primary))]"
                aria-label="Fechar"
              >
                <X size={19} aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">{children}</div>

            {footer && (
              <footer className="sticky bottom-0 z-10 border-t border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface)/0.96)] px-5 py-4 backdrop-blur-xl sm:px-6">
                {footer}
              </footer>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
