import React, { useId } from 'react';

export default function Input({
  className = '',
  description,
  error,
  id,
  label,
  leftIcon,
  required = false,
  rightIcon,
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

      <div className="relative">
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--bubo-color-text-muted))]" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`min-h-11 w-full rounded-[var(--bubo-radius-md)] border bg-[rgb(var(--bubo-color-surface))] px-3 text-[rgb(var(--bubo-color-text))] shadow-[var(--bubo-shadow-sm)] transition placeholder:text-[rgb(var(--bubo-color-text-muted))] focus:border-[rgb(var(--bubo-color-primary))] focus:outline-none focus:ring-4 focus:ring-[rgb(var(--bubo-color-primary)/0.1)] disabled:cursor-not-allowed disabled:bg-[rgb(var(--bubo-color-surface-muted))] disabled:opacity-70 ${leftIcon ? 'pl-11' : ''} ${rightIcon ? 'pr-11' : ''} ${error ? 'border-[rgb(var(--bubo-color-danger))]' : 'border-[rgb(var(--bubo-color-border))]'} ${className}`}
          {...props}
        />
        {rightIcon && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[rgb(var(--bubo-color-text-muted))]" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </div>

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
