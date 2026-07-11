const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateCandidateScore,
  createAdjacency,
  dijkstra,
  rankReaderCandidates,
  tracePath,
} = require('../src/services/social/recommendationGraph');

test('dijkstra returns the shortest social path', () => {
  const graph = createAdjacency([
    { followerId: 'a', followingId: 'b' },
    { followerId: 'b', followingId: 'c' },
    { followerId: 'a', followingId: 'd' },
    { followerId: 'd', followingId: 'e' },
    { followerId: 'e', followingId: 'c' },
  ]);
  const { distances, previous } = dijkstra(graph, 'a');

  assert.equal(distances.get('c'), 2);
  assert.deepEqual(tracePath(previous, 'a', 'c'), ['a', 'b', 'c']);
});

test('shared signals increase the recommendation score', () => {
  const baseline = calculateCandidateScore({ graphDistance: 2 });
  const enriched = calculateCandidateScore({
    graphDistance: 2,
    mutualConnections: 2,
    sharedBooks: 3,
    sharedClubs: 1,
    sharedGenres: 2,
  });

  assert.ok(enriched > baseline);
});

test('ranking excludes self and readers already followed', () => {
  const users = [
    { _id: 'source', username: 'Source' },
    { _id: 'followed', username: 'Already followed' },
    { _id: 'candidate', username: 'Candidate' },
  ];
  const follows = [
    { followerId: 'source', followingId: 'followed' },
    { followerId: 'followed', followingId: 'candidate' },
  ];

  const ranked = rankReaderCandidates({
    sourceUserId: 'source',
    users,
    follows,
    booksByUser: new Map([
      ['source', new Set(['book-1'])],
      ['candidate', new Set(['book-1'])],
    ]),
    clubsByUser: new Map(),
    genresByUser: new Map(),
    activityByUser: new Map(),
  });

  assert.deepEqual(ranked.map((item) => item.userId), ['candidate']);
  assert.equal(ranked[0].graphDistance, 2);
  assert.ok(ranked[0].reasons.some((reason) => reason.includes('livro')));
});

test('interest-compatible readers can be recommended even without a graph path', () => {
  const ranked = rankReaderCandidates({
    sourceUserId: 'source',
    users: [{ _id: 'candidate', username: 'Candidate' }],
    follows: [],
    booksByUser: new Map(),
    clubsByUser: new Map(),
    genresByUser: new Map([
      ['source', new Set(['filosofia'])],
      ['candidate', new Set(['filosofia'])],
    ]),
    activityByUser: new Map(),
  });

  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].graphDistance, null);
  assert.ok(ranked[0].score > 0);
});
