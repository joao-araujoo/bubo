import React from 'react';

export default function Skeleton({
  className = '',
  height,
  width,
  rounded = 'md',
}) {
  const radiusClasses = {
    sm: 'rounded-[var(--bubo-radius-sm)]',
    md: 'rounded-[var(--bubo-radius-md)]',
    lg: 'rounded-[var(--bubo-radius-lg)]',
    full: 'rounded-full',
  };

  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse bg-[rgb(var(--bubo-color-surface-muted))] ${radiusClasses[rounded] || radiusClasses.md} ${className}`}
      style={{ height, width }}
    />
  );
}

export function CardSkeleton({ className = '' }) {
  return (
    <div className={`rounded-[var(--bubo-radius-lg)] border border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface))] p-4 ${className}`}>
      <div className="flex gap-4">
        <Skeleton className="aspect-[2/3] w-24 shrink-0" rounded="md" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-6 h-2 w-full" rounded="full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}
