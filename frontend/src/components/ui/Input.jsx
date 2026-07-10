import React, { useId } from 'react';

export default function Input({
  className = '',
  description,
  error,
  id,
  label,
  required = false,
  ...props
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-2 block text-sm font-semibold text-[rgb(var(--bubo-color-text))]"
        >
          {label}
          {required && (
            <span className="ml-1 text-[rgb(var(--bubo-color-danger))]" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      <input
        id={inputId}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className={`min-h-11 w-full rounded-[var(--bubo-radius-md)] border bg-[rgb(var(--bubo-color-surface))] px-3 text-[rgb(var(--bubo-color-text))] shadow-[var(--bubo-shadow-sm)] transition placeholder:text-[rgb(var(--bubo-color-text-muted))] focus:border-[rgb(var(--bubo-color-primary))] focus:outline-none disabled:cursor-not-allowed disabled:bg-[rgb(var(--bubo-color-surface-muted))] disabled:opacity-70 ${error ? 'border-[rgb(var(--bubo-color-danger))]' : 'border-[rgb(var(--bubo-color-border))]'} ${className}`}
        {...props}
      />

      {description && !error && (
        <p id={descriptionId} className="mt-1.5 text-sm text-[rgb(var(--bubo-color-text-muted))]">
          {description}
        </p>
      )}

      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-[rgb(var(--bubo-color-danger))]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}