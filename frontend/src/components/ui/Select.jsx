import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Select({
  children,
  className = '',
  description,
  error,
  id,
  label,
  required = false,
  ...props
}) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const descriptionId = description ? `${selectId}-description` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-2 block text-sm font-semibold text-[rgb(var(--bubo-color-text))]">
          {label}
          {required && <span className="ml-1 text-[rgb(var(--bubo-color-danger))]" aria-hidden="true">*</span>}
        </label>
      )}

      <div className="relative">
        <select
          id={selectId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`min-h-11 w-full appearance-none rounded-[var(--bubo-radius-md)] border bg-[rgb(var(--bubo-color-surface))] px-3 pr-10 text-[rgb(var(--bubo-color-text))] shadow-[var(--bubo-shadow-sm)] transition focus:border-[rgb(var(--bubo-color-primary))] focus:outline-none disabled:cursor-not-allowed disabled:bg-[rgb(var(--bubo-color-surface-muted))] disabled:opacity-70 ${error ? 'border-[rgb(var(--bubo-color-danger))]' : 'border-[rgb(var(--bubo-color-border))]'} ${className}`}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={18}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[rgb(var(--bubo-color-text-muted))]"
          aria-hidden="true"
        />
      </div>

      {description && !error && <p id={descriptionId} className="mt-1.5 text-sm text-[rgb(var(--bubo-color-text-muted))]">{description}</p>}
      {error && <p id={errorId} className="mt-1.5 text-sm text-[rgb(var(--bubo-color-danger))]" role="alert">{error}</p>}
    </div>
  );
}
