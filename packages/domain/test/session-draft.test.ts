import { describe, expect, it } from 'vitest';
import { focusElapsedMs, pauseFocusClock, resumeFocusClock } from '../src/session-draft';
import { MAX_SESSION_SECONDS } from '../src/sessions';

describe('recoverable focus clock', () => {
  it('survives serialization and counts background time only while running', () => {
    const running = resumeFocusClock(
      { startedAt: null, accumulatedMs: 0, runningSince: null },
      1000,
    );
    const restored = JSON.parse(JSON.stringify(running)) as typeof running;
    expect(focusElapsedMs(restored, 61000)).toBe(60000);
    const paused = pauseFocusClock(restored, 61000);
    expect(focusElapsedMs(paused, 90000)).toBe(60000);
    const resumed = resumeFocusClock(paused, 100000);
    expect(focusElapsedMs(resumed, 120000)).toBe(80000);
    expect(resumed.startedAt).toBe(1000);
  });
  it('caps forgotten sessions and never subtracts time when the clock moves backwards', () => {
    const running = { startedAt: 1000, accumulatedMs: 5000, runningSince: 10000 };
    expect(focusElapsedMs(running, 1000)).toBe(5000);
    const capped = pauseFocusClock(running, 100000000);
    expect(capped.accumulatedMs).toBe(MAX_SESSION_SECONDS * 1000);
    expect(resumeFocusClock(capped, 100000001)).toEqual(capped);
  });
});
