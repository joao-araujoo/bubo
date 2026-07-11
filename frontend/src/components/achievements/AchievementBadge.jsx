import React from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Brain,
  Flame,
  LibraryBig,
  Lock,
  Medal,
  Sparkles,
  Target,
} from 'lucide-react';

const ICONS = {
  book_open: BookOpen,
  brain: Brain,
  flame: Flame,
  library: LibraryBig,
  medal: Medal,
  sparkles: Sparkles,
  target: Target,
};

export default function AchievementBadge({ achievement, index }) {
  const { name, description, iconKey = 'medal', unlocked } = achievement;
  const Icon = ICONS[iconKey] || Medal;

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-[var(--bubo-radius-lg)] border p-5 transition ${
        unlocked
          ? 'border-[rgb(var(--bubo-color-primary)/0.3)] bg-[rgb(var(--bubo-color-surface))] shadow-[var(--bubo-shadow-sm)]'
          : 'border-[rgb(var(--bubo-color-border))] bg-[rgb(var(--bubo-color-surface-muted))] opacity-70'
      }`}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <span className={`grid h-12 w-12 place-items-center rounded-[var(--bubo-radius-md)] ${unlocked ? 'bg-[rgb(var(--bubo-color-primary)/0.1)] text-[rgb(var(--bubo-color-primary))]' : 'bg-[rgb(var(--bubo-color-border)/0.55)] text-[rgb(var(--bubo-color-text-muted))]'}`}>
          {unlocked ? <Icon size={24} strokeWidth={1.9} aria-hidden="true" /> : <Lock size={21} aria-hidden="true" />}
        </span>
        <div>
          <h3 className="text-sm font-extrabold text-[rgb(var(--bubo-color-text))]">{name}</h3>
          <p className="mt-1 text-xs leading-relaxed text-[rgb(var(--bubo-color-text-muted))]">{description}</p>
        </div>
        {unlocked && (
          <span className="rounded-full bg-[rgb(var(--bubo-color-primary)/0.1)] px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-[rgb(var(--bubo-color-primary))]">
            Desbloqueada
          </span>
        )}
      </div>
    </motion.article>
  );
}
