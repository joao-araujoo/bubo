import { MAX_SESSION_SECONDS } from './sessions';

/** Serializable timer; wall time survives process death without counting paused time. */
export type FocusClock = {
  startedAt: number | null;
  accumulatedMs: number;
  runningSince: number | null;
};

export function focusElapsedMs(clock: FocusClock, now: number): number {
  const running = clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince);
  return Math.min(MAX_SESSION_SECONDS * 1000, Math.max(0, clock.accumulatedMs + running));
}

export function pauseFocusClock(clock: FocusClock, now: number): FocusClock {
  return { ...clock, accumulatedMs: focusElapsedMs(clock, now), runningSince: null };
}

export function resumeFocusClock(clock: FocusClock, now: number): FocusClock {
  if (clock.runningSince !== null || focusElapsedMs(clock, now) >= MAX_SESSION_SECONDS * 1000)
    return clock;
  return { ...clock, startedAt: clock.startedAt ?? now, runningSince: now };
}
