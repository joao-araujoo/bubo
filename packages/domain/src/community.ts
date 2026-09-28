/**
 * Anti-spoiler and moderation rules for reading clubs (Task 07, ADR-019). The API applies them
 * before sending anything, so locked content never reaches the device.
 */

/** Distinct readers' reports that hide a topic or reply until the club owner decides. */
export const REPORTS_TO_HIDE = 3;

/**
 * Content is locked when it talks about a page beyond the reader's own page on the club's book.
 * Authors always see their own content; an explicit "espiar" reveals it.
 */
export function isSpoilerLocked(input: {
  spoilerPage: number;
  readerPage: number;
  isMine: boolean;
  revealed: boolean;
}): boolean {
  if (input.isMine || input.revealed) return false;
  return input.spoilerPage > input.readerPage;
}

/** A reply can never be "less spoiler" than its topic: it inherits at least the topic's page. */
export function replySpoilerPage(topicPage: number, requestedPage: number): number {
  return Math.max(topicPage, requestedPage);
}

/** Pages left before content unlocks for the reader (0 when already unlocked). */
export function pagesUntilUnlocked(spoilerPage: number, readerPage: number): number {
  return Math.max(0, spoilerPage - readerPage);
}

export type ModerationStatus = 'visible' | 'hidden' | 'removed';

/** Who may see a topic/reply in each moderation state. Removed content is never shown. */
export function canSeeModerated(input: {
  status: ModerationStatus;
  isAuthor: boolean;
  isClubOwner: boolean;
}): boolean {
  if (input.status === 'visible') return true;
  if (input.status === 'hidden') return input.isAuthor || input.isClubOwner;
  return false;
}

/** Status after a new report, given how many distinct readers have reported it so far. */
export function statusAfterReport(
  current: ModerationStatus,
  reportCount: number,
): ModerationStatus {
  return current === 'visible' && reportCount >= REPORTS_TO_HIDE ? 'hidden' : current;
}
