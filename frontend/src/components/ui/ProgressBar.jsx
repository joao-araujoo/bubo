import React from 'react';

export default function ProgressBar({
  className = '',
  label,
  max = 100,
  showValue = false,
  value = 0,
}) {
  const safeMax = max > 0 ? max : 100;
  const safeValue = Math.min(Math.max(Number(value) || 0, 0), safeMax);
  const percentage = Math.round((safeValue / safeMax) * 100);

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          {label && <span className="text-[rgb(var(--bubo-color-text-muted))]">{label}</span>}
          {showValue && <strong className="text-[rgb(var(--bubo-color-text))]">{safeValue} / {safeMax}</strong>}
        </div>
      )}
      <div
        className="h-2 overflow-hidden rounded-full bg-[rgb(var(--bubo-color-surface-muted))]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={safeValue}
        aria-label={label || 'Progresso'}
      >
        <div
          className="h-full rounded-full bg-[rgb(var(--bubo-color-primary))] transition-[width] duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
