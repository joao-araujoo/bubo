import { describe, expect, it } from 'vitest';

import { COGNITIVE_LEVELS, levelForXp } from '../src';

describe('levelForXp', () => {
  it('starts every reader at level 1 with no XP', () => {
    expect(levelForXp(0)).toEqual({
      level: 1,
      title: 'Leitor curioso',
      xpTotal: 0,
      levelStartXp: 0,
      nextLevelXp: 100,
      nextLevelTitle: 'Aprendiz atento',
    });
  });

  it('switches level exactly at the threshold', () => {
    expect(levelForXp(99).level).toBe(1);
    expect(levelForXp(100)).toMatchObject({ level: 2, levelStartXp: 100, nextLevelXp: 300 });
  });

  it('has no next level at the top', () => {
    const top = COGNITIVE_LEVELS[COGNITIVE_LEVELS.length - 1];
    expect(levelForXp(1_000_000)).toMatchObject({
      level: top?.level,
      nextLevelXp: null,
      nextLevelTitle: null,
    });
  });

  it('treats invalid XP as zero', () => {
    expect(levelForXp(-5).level).toBe(1);
    expect(levelForXp(Number.NaN).xpTotal).toBe(0);
  });

  it('has strictly increasing thresholds', () => {
    COGNITIVE_LEVELS.forEach((level, index) => {
      if (index > 0) expect(level.minXp).toBeGreaterThan(COGNITIVE_LEVELS[index - 1]?.minXp ?? 0);
    });
  });
});
