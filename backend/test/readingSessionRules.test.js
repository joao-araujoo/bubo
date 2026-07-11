const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeReadingSessionInput } = require('../src/services/reading/readingSessionRules');

test('reading session defaults to the next unread page and computes pages read', () => {
  const input = normalizeReadingSessionInput({ pageTo: 135, durationMinutes: 42, focus: 'high' }, {
    currentPage: 120,
    totalPages: 412,
  });

  assert.equal(input.pageFrom, 121);
  assert.equal(input.pageTo, 135);
  assert.equal(input.pagesRead, 15);
  assert.equal(input.durationMinutes, 42);
  assert.equal(input.focus, 'high');
});

test('reading session accepts past ranges without reducing the current progress', () => {
  const input = normalizeReadingSessionInput({ pageFrom: 30, pageTo: 45, note: 'Releitura importante.' }, {
    currentPage: 120,
    totalPages: 300,
  });

  assert.equal(input.pageFrom, 30);
  assert.equal(input.pageTo, 45);
  assert.equal(input.pagesRead, 16);
  assert.equal(input.note, 'Releitura importante.');
});

test('reading session rejects pages beyond the selected edition', () => {
  assert.throws(
    () => normalizeReadingSessionInput({ pageFrom: 190, pageTo: 220 }, { currentPage: 180, totalPages: 200 }),
    (error) => error.code === 'READING_SESSION_TOTAL_EXCEEDED' && error.status === 400,
  );
});

test('reading session rejects future dates and excessive duration', () => {
  assert.throws(
    () => normalizeReadingSessionInput({ pageTo: 20, durationMinutes: 2000 }, { currentPage: 0, totalPages: 200 }),
    (error) => error.code === 'READING_SESSION_DURATION_INVALID',
  );

  assert.throws(
    () => normalizeReadingSessionInput({ pageTo: 20, readAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() }, { currentPage: 0, totalPages: 200 }),
    (error) => error.code === 'READING_SESSION_DATE_IN_FUTURE',
  );
});
