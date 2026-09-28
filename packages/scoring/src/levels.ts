/**
 * Cognitive levels from total XP (ADR-018). XP itself only comes from real sessions and reviews
 * (ADR-014), so a level is a readable summary of effort, never a measure of memory.
 * A 30-minute focused session earns ~30 XP; each graded review earns 2–5 XP.
 */
export const COGNITIVE_LEVELS = [
  { level: 1, minXp: 0, title: 'Leitor curioso' },
  { level: 2, minXp: 100, title: 'Aprendiz atento' },
  { level: 3, minXp: 300, title: 'Leitor constante' },
  { level: 4, minXp: 600, title: 'Explorador de ideias' },
  { level: 5, minXp: 1000, title: 'Guardião da memória' },
  { level: 6, minXp: 1600, title: 'Pensador profundo' },
  { level: 7, minXp: 2400, title: 'Arquiteto de conceitos' },
  { level: 8, minXp: 3500, title: 'Mestre da leitura' },
] as const;

export type CognitiveLevel = {
  level: number;
  title: string;
  xpTotal: number;
  /** XP where the current level starts. */
  levelStartXp: number;
  /** XP where the next level starts, or null at the top level. */
  nextLevelXp: number | null;
  nextLevelTitle: string | null;
};

export function levelForXp(xpTotal: number): CognitiveLevel {
  const xp = Number.isFinite(xpTotal) && xpTotal > 0 ? Math.floor(xpTotal) : 0;
  let index = 0;
  COGNITIVE_LEVELS.forEach((candidate, i) => {
    if (xp >= candidate.minXp) index = i;
  });
  const current = COGNITIVE_LEVELS[index] ?? COGNITIVE_LEVELS[0];
  const next = COGNITIVE_LEVELS[index + 1];
  return {
    level: current.level,
    title: current.title,
    xpTotal: xp,
    levelStartXp: current.minXp,
    nextLevelXp: next?.minXp ?? null,
    nextLevelTitle: next?.title ?? null,
  };
}
