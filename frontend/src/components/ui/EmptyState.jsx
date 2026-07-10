import React from 'react';
import { BookOpen } from 'lucide-react';
import Button from './Button';

export default function EmptyState({
  actionLabel,
  className = '',
  description,
  icon: Icon = BookOpen,
  onAction,
  title,
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-[var(--bubo-radius-lg)] border border-dashed border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] px-5 py-10 text-center ${className}`}>
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]">
        <Icon size={22} aria-hidden="true" />
      </span>
      <h3 className="text-base font-bold text-[rgb(var(--bubo-color-text))]">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm leading-6 text-[rgb(var(--bubo-color-text-muted))]">{description}</p>}
      {actionLabel && onAction && <Button className="mt-5" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
}
