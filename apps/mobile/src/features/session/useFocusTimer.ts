import {
  MAX_SESSION_SECONDS,
  focusElapsedMs,
  pauseFocusClock,
  resumeFocusClock,
} from '@bubo/domain';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { type SessionDraft } from './draft-storage';

const KEEP_AWAKE_TAG = 'bubo-focus-session';

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

/** Transitions are persisted before the UI confirms them. Ticks never write to disk. */
export function useFocusTimer(
  draft: SessionDraft,
  persist: (draft: SessionDraft) => Promise<void>,
) {
  const [now, setNow] = useState(() => Date.now());
  const running = draft.runningSince !== null;
  const elapsedMs = focusElapsedMs(draft, now);
  const reachedCap = elapsedMs >= MAX_SESSION_SECONDS * 1000;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      clearInterval(id);
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [running]);

  async function pause() {
    const stamp = Date.now();
    await persist({ ...draft, ...pauseFocusClock(draft, stamp) });
    setNow(stamp);
  }
  async function start() {
    const stamp = Date.now();
    await persist({ ...draft, ...resumeFocusClock(draft, stamp) });
    setNow(stamp);
  }
  async function finish() {
    const stamp = Date.now();
    await persist({ ...draft, ...pauseFocusClock(draft, stamp), endedAt: stamp });
    setNow(stamp);
  }
  return {
    status: draft.startedAt === null ? 'idle' : running && !reachedCap ? 'running' : 'paused',
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    reachedCap,
    start,
    pause,
    finish,
  };
}
