import { describe, expect, it } from 'vitest';

import {
  latestReadingReflection,
  newReadingGoal,
  shouldShowReadingGoalNotice,
  type ReadingReturnSession,
} from '../src/reading-return';
import { focusElapsedMs, pauseFocusClock } from '../src/session-draft';

const oldSession: ReadingReturnSession = {
  id: 'old',
  shelfEntryId: 'book',
  endedAt: '2026-10-01T12:00:00Z',
  endPage: 12,
  reflection: 'A personagem decide voltar para casa.',
};

describe('returning to a reading', () => {
  it('selects the most recent real reflection for this book without assuming response order', () => {
    const recent = {
      ...oldSession,
      id: 'recent',
      endedAt: '2026-10-03T12:00:00Z',
      reflection: null,
      recall: { idea: 'Uma escolha.', detail: 'A carta.', connection: 'Um recomeço.' },
    };
    const foreign = { ...recent, id: 'foreign', shelfEntryId: 'another-book' };
    expect(latestReadingReflection('book', [recent, oldSession, foreign])).toEqual(recent);
    expect(latestReadingReflection('another-book', [oldSession, recent])).toBeNull();
  });

  it('skips empty writing and malformed dates and never invents a first reflection', () => {
    expect(latestReadingReflection('book', [])).toBeNull();
    const empty = { ...oldSession, endedAt: '2026-10-04T12:00:00Z', reflection: '  ' };
    const invalid = { ...oldSession, endedAt: 'invalid' };
    expect(latestReadingReflection('book', [empty, invalid])).toBeNull();
    expect(latestReadingReflection('book', [oldSession, empty, invalid])).toEqual(oldSession);
  });
});

describe('five-minute reading goal', () => {
  const draft = {
    ...newReadingGoal('5'),
    startedAt: 1000,
    runningSince: 1000,
    accumulatedMs: 0,
    endedAt: null,
  };

  it('recognizes only the explicit route option when creating a new draft', () => {
    expect(newReadingGoal('5')).toEqual({ goalSeconds: 300, goalNoticeShown: false });
    expect(newReadingGoal(undefined)).toEqual({});
    expect(newReadingGoal('10')).toEqual({});
    expect(newReadingGoal(['5', '5'])).toEqual({});
  });

  it('becomes eligible at 300 seconds without stopping the clock or counting paused time', () => {
    expect(shouldShowReadingGoalNotice(draft, 300999)).toBe(false);
    expect(shouldShowReadingGoalNotice(draft, 301000)).toBe(true);
    const paused = { ...draft, ...pauseFocusClock(draft, 121000) };
    expect(shouldShowReadingGoalNotice(paused, 901000)).toBe(false);
    expect(focusElapsedMs(draft, 361000)).toBe(360000);
    expect(draft.runningSince).toBe(1000);
    expect(draft.endedAt).toBeNull();
  });

  it('survives serialization and avoids notices for completed, acknowledged and legacy sessions', () => {
    const restored = JSON.parse(JSON.stringify(draft)) as typeof draft;
    expect(shouldShowReadingGoalNotice(restored, 301000)).toBe(true);
    expect(shouldShowReadingGoalNotice({ ...restored, goalNoticeShown: true }, 501000)).toBe(false);
    expect(shouldShowReadingGoalNotice({ ...restored, endedAt: 301000 }, 501000)).toBe(false);
    expect(shouldShowReadingGoalNotice({ ...restored, startedAt: null }, 501000)).toBe(false);
    const legacy = { startedAt: 1000, accumulatedMs: 400000, runningSince: null, endedAt: null };
    expect(shouldShowReadingGoalNotice(legacy, 501000)).toBe(false);
  });
});
