import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SESSION_TARGET_MINUTES,
  crossedReadingMilestone,
  sessionTargetMinutes,
  streakMilestones,
} from '../src/reading-flow';

describe('the milestone printed on the reading receipt', () => {
  it('is the highest quarter crossed in the session', () => {
    expect(crossedReadingMilestone(126, 140, 264)).toBe(50);
    expect(crossedReadingMilestone(60, 200, 264)).toBe(75);
    expect(crossedReadingMilestone(250, 264, 264)).toBe(100);
  });

  it('counts the exact milestone page as reached', () => {
    expect(crossedReadingMilestone(131, 132, 264)).toBe(50);
    expect(crossedReadingMilestone(132, 140, 264)).toBeNull();
  });

  it('is absent without progress or a known page count', () => {
    expect(crossedReadingMilestone(10, 20, 264)).toBeNull();
    expect(crossedReadingMilestone(140, 140, 264)).toBeNull();
    expect(crossedReadingMilestone(10, 200, 0)).toBeNull();
  });
});

describe('streak milestones', () => {
  it('marks reached milestones and counts down to the next one', () => {
    expect(streakMilestones(13, 13)).toEqual([
      { days: 7, state: 'done', daysLeft: 0 },
      { days: 15, state: 'next', daysLeft: 2 },
      { days: 30, state: 'later', daysLeft: 17 },
      { days: 50, state: 'later', daysLeft: 37 },
      { days: 100, state: 'later', daysLeft: 87 },
    ]);
  });

  it('keeps milestones reached by the longest streak', () => {
    const marks = streakMilestones(3, 21);
    expect(marks.map((mark) => mark.state)).toEqual(['done', 'done', 'next', 'later', 'later']);
    expect(marks[2]).toEqual({ days: 30, state: 'next', daysLeft: 27 });
  });

  it('starts from zero without activity', () => {
    expect(streakMilestones(0, 0)[0]).toEqual({ days: 7, state: 'next', daysLeft: 7 });
  });
});

describe('the leaves of the night timer', () => {
  it('uses the session goal first', () => {
    expect(
      sessionTargetMinutes({ goalSeconds: 300, dailyGoalMinutes: 20, focusedMinutesToday: 0 }),
    ).toBe(5);
  });

  it('draws what is left of the day goal', () => {
    expect(sessionTargetMinutes({ dailyGoalMinutes: 20, focusedMinutesToday: 8 })).toBe(12);
    expect(sessionTargetMinutes({ dailyGoalMinutes: 15, focusedMinutesToday: null })).toBe(15);
  });

  it('falls back to a default when the goal is met or unknown', () => {
    expect(sessionTargetMinutes({ dailyGoalMinutes: 15, focusedMinutesToday: 15 })).toBe(
      DEFAULT_SESSION_TARGET_MINUTES,
    );
    expect(sessionTargetMinutes({ dailyGoalMinutes: null, focusedMinutesToday: 3 })).toBe(
      DEFAULT_SESSION_TARGET_MINUTES,
    );
  });
});
