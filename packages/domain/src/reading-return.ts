import { focusElapsedMs, type FocusClock } from './session-draft';

export const MINI_READING_GOAL_SECONDS = 300;

export type ReadingReturnSession = {
  id: string;
  shelfEntryId: string;
  endedAt: string;
  endPage: number;
  reflection: string | null;
  recall?: { idea: string; detail: string; connection: string } | null;
};

/** Picks the latest real writing for this book, regardless of response order. */
export function latestReadingReflection(
  shelfEntryId: string,
  sessions: readonly ReadingReturnSession[],
): ReadingReturnSession | null {
  let latest: ReadingReturnSession | null = null;
  let latestStamp = -Infinity;
  for (const session of sessions) {
    if (session.shelfEntryId !== shelfEntryId) continue;
    const stamp = Date.parse(session.endedAt);
    if (!Number.isFinite(stamp) || stamp <= latestStamp) continue;
    const hasWriting =
      Boolean(session.reflection?.trim()) ||
      Boolean(
        session.recall &&
        (session.recall.idea.trim() ||
          session.recall.detail.trim() ||
          session.recall.connection.trim()),
      );
    if (!hasWriting) continue;
    latest = session;
    latestStamp = stamp;
  }
  return latest;
}

/** The route goal applies only when constructing a new draft, never on recovery. */
export function newReadingGoal(goal: string | readonly string[] | undefined): {
  goalSeconds?: 300;
  goalNoticeShown?: boolean;
} {
  return goal === '5' ? { goalSeconds: MINI_READING_GOAL_SECONDS, goalNoticeShown: false } : {};
}

/** No timer transition: reaching five minutes only makes a gentle notice eligible. */
export function shouldShowReadingGoalNotice(
  draft: FocusClock & {
    goalSeconds?: number;
    goalNoticeShown?: boolean;
    endedAt: number | null;
  },
  now: number,
): boolean {
  return (
    draft.goalSeconds === MINI_READING_GOAL_SECONDS &&
    draft.goalNoticeShown !== true &&
    draft.startedAt !== null &&
    draft.endedAt === null &&
    focusElapsedMs(draft, now) >= MINI_READING_GOAL_SECONDS * 1000
  );
}
