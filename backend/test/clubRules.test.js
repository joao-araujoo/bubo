const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeClubProgress,
  normalizeDiscussionPages,
} = require('../src/services/clubs/clubRules');

test('club progress is clamped to the book total', () => {
  assert.equal(normalizeClubProgress(180, 300), 180);
  assert.equal(normalizeClubProgress(420, 300), 300);
});

test('club progress rejects negative and non-integer values', () => {
  assert.throws(
    () => normalizeClubProgress(-1, 300),
    (error) => error.code === 'CLUB_PROGRESS_INVALID' && error.status === 400,
  );
  assert.throws(
    () => normalizeClubProgress('abc', 300),
    (error) => error.code === 'CLUB_PROGRESS_INVALID',
  );
});

test('discussion pages may be omitted together', () => {
  assert.deepEqual(normalizeDiscussionPages({}, 300), {
    pageFrom: undefined,
    pageTo: undefined,
  });
});

test('discussion pages must be provided as a valid pair', () => {
  assert.throws(
    () => normalizeDiscussionPages({ pageFrom: 20 }, 300),
    (error) => error.code === 'CLUB_DISCUSSION_PAGE_PAIR_REQUIRED',
  );
  assert.throws(
    () => normalizeDiscussionPages({ pageFrom: 40, pageTo: 30 }, 300),
    (error) => error.code === 'CLUB_DISCUSSION_PAGE_ORDER_INVALID',
  );
  assert.throws(
    () => normalizeDiscussionPages({ pageFrom: 280, pageTo: 320 }, 300),
    (error) => error.code === 'CLUB_DISCUSSION_TOTAL_EXCEEDED',
  );
});

test('discussion pages are normalized when valid', () => {
  assert.deepEqual(normalizeDiscussionPages({ pageFrom: '20', pageTo: '35' }, 300), {
    pageFrom: 20,
    pageTo: 35,
  });
});
