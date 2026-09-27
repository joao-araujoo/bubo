import { MAX_SESSION_SECONDS } from '@bubo/domain';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useState } from 'react';

const KEEP_AWAKE_TAG = 'bubo-focus-session';

type TimerState = {
  status: 'idle' | 'running' | 'paused';
  /** Wall-clock time of the first start. */
  startedAt: Date | null;
  /** Focused milliseconds accumulated before the current run. */
  accumulatedMs: number;
  /** When the current run began (epoch ms), or null when not running. */
  runningSince: number | null;
};

const INITIAL: TimerState = {
  status: 'idle',
  startedAt: null,
  accumulatedMs: 0,
  runningSince: null,
};

/** Focused time in ms. Uses timestamps (not tick counts), so it stays exact in the background. */
export function focusedMs(state: TimerState, now: number): number {
  const running = state.runningSince !== null ? now - state.runningSince : 0;
  return Math.min(state.accumulatedMs + running, MAX_SESSION_SECONDS * 1000);
}

/** mm:ss, or h:mm:ss from one hour on. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Focus timer for a reading session: start / pause / resume, keeps the screen awake while
 * running and stops at the 4-hour cap.
 */
export function useFocusTimer() {
  const [state, setState] = useState<TimerState>(INITIAL);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== 'running') return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [state.status]);

  const elapsedMs = focusedMs(state, now);
  const reachedCap = elapsedMs >= MAX_SESSION_SECONDS * 1000;

  const pause = useCallback(() => {
    setState((s) => {
      if (s.status !== 'running' || s.runningSince === null) return s;
      const stamp = Date.now();
      return { ...s, status: 'paused', accumulatedMs: focusedMs(s, stamp), runningSince: null };
    });
    setNow(Date.now());
  }, []);

  useEffect(() => {
    if (reachedCap && state.status === 'running') pause();
  }, [reachedCap, state.status, pause]);

  const start = useCallback(() => {
    const stamp = Date.now();
    setNow(stamp);
    setState((s) => {
      if (s.status === 'running') return s;
      return {
        ...s,
        status: 'running',
        startedAt: s.startedAt ?? new Date(stamp),
        runningSince: stamp,
      };
    });
  }, []);

  /** Freezes the timer and returns its final values (for saving the session). */
  const finish = useCallback(() => {
    const stamp = Date.now();
    const final = {
      ...state,
      accumulatedMs: focusedMs(state, stamp),
      runningSince: null,
      status: 'paused' as const,
    };
    setState(final);
    setNow(stamp);
    return {
      startedAt: final.startedAt ?? new Date(stamp),
      endedAt: new Date(stamp),
      focusedSeconds: Math.floor(final.accumulatedMs / 1000),
    };
  }, [state]);

  return {
    status: state.status,
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    reachedCap,
    start,
    pause,
    finish,
  };
}
