import { describe, expect, it } from 'vitest';

import { dailyStamps, greetingPeriod, GREETING_BY_PERIOD, nextReadingMilestone } from '../src/home';

describe('the greeting in Hoje', () => {
  it('follows the local hour', () => {
    expect(greetingPeriod(5)).toBe('morning');
    expect(greetingPeriod(11)).toBe('morning');
    expect(greetingPeriod(12)).toBe('afternoon');
    expect(greetingPeriod(17)).toBe('afternoon');
    expect(greetingPeriod(18)).toBe('night');
    expect(greetingPeriod(0)).toBe('night');
    expect(greetingPeriod(4)).toBe('night');
    expect(GREETING_BY_PERIOD[greetingPeriod(22)]).toBe('Boa noite');
  });
});

describe('the next reading milestone', () => {
  it('counts the pages left to the next quarter of the book', () => {
    expect(nextReadingMilestone(126, 264)).toEqual({ percent: 50, page: 132, pagesLeft: 6 });
    expect(nextReadingMilestone(0, 264)).toEqual({ percent: 25, page: 66, pagesLeft: 66 });
    expect(nextReadingMilestone(132, 264)).toEqual({ percent: 75, page: 198, pagesLeft: 66 });
    expect(nextReadingMilestone(263, 264)).toEqual({ percent: 100, page: 264, pagesLeft: 1 });
  });

  it('is absent for finished books and unknown page counts', () => {
    expect(nextReadingMilestone(264, 264)).toBeNull();
    expect(nextReadingMilestone(10, 0)).toBeNull();
    expect(nextReadingMilestone(10, Number.NaN)).toBeNull();
  });
});

describe('the daily card', () => {
  const base = {
    focusedMinutesToday: 0,
    goalMinutes: 20,
    readToday: false,
    reviewedToday: false,
    dueCards: 3,
  };

  it('stamps only what really happened today', () => {
    expect(dailyStamps(base)).toEqual([
      { id: 'focus', label: 'Ler 20 min', done: false },
      { id: 'recall', label: 'Lembrar sem espiar', done: false },
      { id: 'review', label: 'Revisar cards', done: false },
    ]);
    const stamps = dailyStamps({ ...base, focusedMinutesToday: 24, readToday: true });
    expect(stamps.map((stamp) => stamp.done)).toEqual([true, true, false]);
  });

  it('falls back to reading today when the goal is unknown', () => {
    expect(dailyStamps({ ...base, goalMinutes: null, readToday: true })[0]).toEqual({
      id: 'focus',
      label: 'Ler hoje',
      done: true,
    });
  });

  it('has no review stamp when nothing is due and nothing was reviewed', () => {
    expect(dailyStamps({ ...base, dueCards: 0 }).map((stamp) => stamp.id)).toEqual([
      'focus',
      'recall',
    ]);
    expect(
      dailyStamps({ ...base, dueCards: 0, reviewedToday: true }).map((stamp) => stamp.id),
    ).toEqual(['focus', 'recall', 'review']);
  });
});
