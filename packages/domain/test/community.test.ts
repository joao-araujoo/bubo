import { describe, expect, it } from 'vitest';

import {
  REPORTS_TO_HIDE,
  canSeeModerated,
  isSpoilerLocked,
  pagesUntilUnlocked,
  replySpoilerPage,
  statusAfterReport,
} from '../src';

describe('isSpoilerLocked', () => {
  const base = { spoilerPage: 120, readerPage: 100, isMine: false, revealed: false };
  it('locks content beyond the reader page', () => {
    expect(isSpoilerLocked(base)).toBe(true);
  });
  it('unlocks at exactly the reader page and before it', () => {
    expect(isSpoilerLocked({ ...base, readerPage: 120 })).toBe(false);
    expect(isSpoilerLocked({ ...base, spoilerPage: 0 })).toBe(false);
  });
  it('never locks the author or an explicit reveal', () => {
    expect(isSpoilerLocked({ ...base, isMine: true })).toBe(false);
    expect(isSpoilerLocked({ ...base, revealed: true })).toBe(false);
  });
});

describe('replySpoilerPage', () => {
  it('never goes below the topic page', () => {
    expect(replySpoilerPage(300, 10)).toBe(300);
    expect(replySpoilerPage(300, 320)).toBe(320);
  });
});

describe('pagesUntilUnlocked', () => {
  it('counts the remaining pages, never negative', () => {
    expect(pagesUntilUnlocked(320, 126)).toBe(194);
    expect(pagesUntilUnlocked(100, 126)).toBe(0);
  });
});

describe('moderation', () => {
  it('shows hidden content only to its author and the club owner', () => {
    const hidden = { status: 'hidden' as const, isAuthor: false, isClubOwner: false };
    expect(canSeeModerated(hidden)).toBe(false);
    expect(canSeeModerated({ ...hidden, isAuthor: true })).toBe(true);
    expect(canSeeModerated({ ...hidden, isClubOwner: true })).toBe(true);
    expect(canSeeModerated({ ...hidden, status: 'visible' })).toBe(true);
    expect(canSeeModerated({ status: 'removed', isAuthor: true, isClubOwner: true })).toBe(false);
  });

  it('hides after the threshold of distinct reports, and only visible content', () => {
    expect(statusAfterReport('visible', REPORTS_TO_HIDE - 1)).toBe('visible');
    expect(statusAfterReport('visible', REPORTS_TO_HIDE)).toBe('hidden');
    expect(statusAfterReport('removed', 10)).toBe('removed');
  });
});
