import {
  MAX_SESSION_SECONDS,
  focusElapsedMs,
  pauseFocusClock,
  resumeFocusClock,
  shouldShowReadingGoalNotice,
} from '@bubo/domain';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { haptics } from '../../lib/haptics';
import { type SessionDraft, type SessionDraftPersist } from './draft-storage';

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
export function useFocusTimer(draft: SessionDraft, persist: SessionDraftPersist) {
  const [now, setNow] = useState(() => Date.now());
  const running = draft.runningSince !== null;
  const elapsedMs = focusElapsedMs(draft, now);
  const reachedCap = elapsedMs >= MAX_SESSION_SECONDS * 1000;
  const goalNoticeEligible = shouldShowReadingGoalNotice(draft, now);
  const goalNoticeAttempted = useRef(false);
  const goalNoticePending = useRef(false);
  const [goalNoticeError, setGoalNoticeError] = useState(false);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      clearInterval(id);
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [running]);

  async function acknowledgeGoal() {
    if (goalNoticePending.current) return;
    goalNoticePending.current = true;
    goalNoticeAttempted.current = true;
    setGoalNoticeError(false);
    let acknowledged = false;
    try {
      // Resolve against the queued current draft: a concurrent pause/finish must survive.
      await persist((current) => {
        if (!shouldShowReadingGoalNotice(current, Date.now())) return current;
        acknowledged = true;
        return { ...current, goalNoticeShown: true };
      });
      if (acknowledged) haptics.success();
    } catch {
      setGoalNoticeError(true);
    } finally {
      goalNoticePending.current = false;
    }
  }

  useEffect(() => {
    if (goalNoticeEligible && !goalNoticeAttempted.current) void acknowledgeGoal();
  });

  async function pause() {
    const stamp = Date.now();
    await persist((current) => ({ ...current, ...pauseFocusClock(current, stamp) }));
    setNow(stamp);
  }
  async function start() {
    const stamp = Date.now();
    await persist((current) => ({ ...current, ...resumeFocusClock(current, stamp) }));
    setNow(stamp);
  }
  async function finish() {
    const stamp = Date.now();
    await persist((current) => ({
      ...current,
      ...pauseFocusClock(current, stamp),
      endedAt: stamp,
    }));
    setNow(stamp);
  }
  return {
    status: draft.startedAt === null ? 'idle' : running && !reachedCap ? 'running' : 'paused',
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    reachedCap,
    goalNoticeError,
    acknowledgeGoal,
    start,
    pause,
    finish,
  };
}
