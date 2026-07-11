import React from 'react';
import { motion } from 'framer-motion';

export default function CognitiveDepthMeter({ score = 0, size = 120 }) {
  const normalizedScore = Math.min(100, Math.max(0, Number(score) || 0));

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative grid place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(rgb(var(--bubo-color-primary)) ${normalizedScore * 3.6}deg, rgb(var(--bubo-color-border)) 0deg)`,
        }}
        role="img"
        aria-label={`Profundidade cognitiva: ${normalizedScore} de 100`}
      >
        <div
          className="grid place-items-center rounded-full bg-[rgb(var(--bubo-color-surface))] shadow-[inset_0_0_0_1px_rgb(var(--bubo-color-border))]"
          style={{ width: size - 16, height: size - 16 }}
        >
          <div className="text-center">
            <span className="block text-2xl font-black text-[rgb(var(--bubo-color-primary))]">{normalizedScore}</span>
            <span className="block text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[rgb(var(--bubo-color-text-muted))]">de 100</span>
          </div>
        </div>
      </motion.div>
      <p className="text-center text-xs font-semibold text-[rgb(var(--bubo-color-text-muted))]">Profundidade cognitiva</p>
    </div>
  );
}
