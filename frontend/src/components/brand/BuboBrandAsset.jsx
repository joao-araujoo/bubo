import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const SOURCES = {
  mark: ['/brand/bubo-logo.png'],
  wordmark: ['/brand/bubo-wordmark.png', '/brand/bubo-logo.png'],
  mascot: ['/brand/bubo-mascot.png', '/brand/bubo-logo.png'],
};

const stateMotion = {
  idle: { y: 0, scale: 1 },
  thinking: { y: [0, -4, 0], scale: [1, 1.025, 1] },
  guiding: { y: 0, scale: 1 },
  approved: { y: [0, -5, 0], scale: [1, 1.035, 1] },
};

export default function BuboBrandAsset({
  alt = 'Bubo',
  className = '',
  size = 48,
  state = 'idle',
  variant = 'mark',
}) {
  const candidates = useMemo(() => SOURCES[variant] || SOURCES.mark, [variant]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const source = candidates[sourceIndex];
  const isWordmark = variant === 'wordmark';

  const handleError = () => {
    if (sourceIndex < candidates.length - 1) {
      setSourceIndex((current) => current + 1);
      return;
    }
    setFailed(true);
  };

  const width = isWordmark ? Math.max(size * 3.2, 132) : size;

  return (
    <motion.span
      animate={stateMotion[state] || stateMotion.idle}
      transition={state === 'thinking'
        ? { duration: 1.15, repeat: Infinity, ease: 'easeInOut' }
        : { duration: 0.35, ease: 'easeOut' }}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width, height: size }}
      data-bubo-brand-asset={variant}
    >
      {!failed ? (
        <img
          src={source}
          alt={alt}
          width={width}
          height={size}
          onError={handleError}
          className="h-full w-full select-none object-contain"
          draggable="false"
        />
      ) : (
        <span
          role="img"
          aria-label={alt}
          className={`inline-flex h-full w-full items-center justify-center rounded-[var(--bubo-radius-md)] border border-[rgb(var(--bubo-color-primary)/0.22)] bg-[rgb(var(--bubo-color-primary)/0.08)] font-black tracking-[-0.04em] text-[rgb(var(--bubo-color-primary))] ${isWordmark ? 'px-4 text-xl' : 'text-lg'}`}
        >
          {isWordmark ? 'Bubo' : 'B'}
        </span>
      )}
    </motion.span>
  );
}
