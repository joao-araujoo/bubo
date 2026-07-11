const normalizeId = (value) => String(value?._id || value || '');

const createAdjacency = (follows = []) => {
  const graph = new Map();
  const addEdge = (from, to, weight) => {
    if (!from || !to || from === to) return;
    const edges = graph.get(from) || [];
    const existing = edges.find((edge) => edge.node === to);
    if (!existing || existing.weight > weight) {
      graph.set(from, [...edges.filter((edge) => edge.node !== to), { node: to, weight }]);
    }
  };

  follows.forEach((follow) => {
    const follower = normalizeId(follow.followerId);
    const following = normalizeId(follow.followingId);
    addEdge(follower, following, 1);
    addEdge(following, follower, 1.15);
  });

  return graph;
};

const dijkstra = (graph, source) => {
  const distances = new Map([[source, 0]]);
  const previous = new Map();
  const visited = new Set();
  const queue = [{ node: source, distance: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift();
    if (!current || visited.has(current.node)) continue;
    visited.add(current.node);

    const neighbors = graph.get(current.node) || [];
    neighbors.forEach(({ node, weight }) => {
      if (visited.has(node)) return;
      const nextDistance = current.distance + Number(weight || 1);
      const knownDistance = distances.get(node) ?? Number.POSITIVE_INFINITY;
      if (nextDistance < knownDistance) {
        distances.set(node, nextDistance);
        previous.set(node, current.node);
        queue.push({ node, distance: nextDistance });
      }
    });
  }

  return { distances, previous };
};

const tracePath = (previous, source, target) => {
  if (source === target) return [source];
  const path = [];
  let cursor = target;
  const guard = new Set();

  while (cursor && !guard.has(cursor)) {
    guard.add(cursor);
    path.unshift(cursor);
    if (cursor === source) return path;
    cursor = previous.get(cursor);
  }
  return [];
};

const intersectionCount = (left = new Set(), right = new Set()) => {
  let count = 0;
  left.forEach((value) => {
    if (right.has(value)) count += 1;
  });
  return count;
};

const calculateCandidateScore = ({
  graphDistance,
  mutualConnections = 0,
  sharedBooks = 0,
  sharedClubs = 0,
  sharedGenres = 0,
  recentActivity = 0,
}) => {
  const distanceScore = Number.isFinite(graphDistance)
    ? Math.max(0, 54 - graphDistance * 12)
    : 0;

  return Math.round(
    distanceScore
    + Math.min(mutualConnections, 6) * 12
    + Math.min(sharedClubs, 4) * 15
    + Math.min(sharedBooks, 8) * 7
    + Math.min(sharedGenres, 6) * 5
    + Math.min(recentActivity, 5) * 2,
  );
};

const buildReasons = ({ graphDistance, mutualConnections, sharedBooks, sharedClubs, sharedGenres }) => {
  const reasons = [];
  if (mutualConnections > 0) reasons.push(`${mutualConnections} conexão${mutualConnections > 1 ? 'ões' : ''} em comum`);
  if (sharedClubs > 0) reasons.push(`${sharedClubs} clube${sharedClubs > 1 ? 's' : ''} compartilhado${sharedClubs > 1 ? 's' : ''}`);
  if (sharedBooks > 0) reasons.push(`${sharedBooks} livro${sharedBooks > 1 ? 's' : ''} em comum`);
  if (sharedGenres > 0) reasons.push(`${sharedGenres} gênero${sharedGenres > 1 ? 's' : ''} de interesse em comum`);
  if (reasons.length === 0 && Number.isFinite(graphDistance)) {
    const hops = Math.max(1, Math.round(graphDistance));
    reasons.push(`próximo a ${hops} passo${hops > 1 ? 's' : ''} na rede`);
  }
  if (reasons.length === 0) reasons.push('perfil de leitura compatível');
  return reasons.slice(0, 3);
};

const rankReaderCandidates = ({
  sourceUserId,
  users = [],
  follows = [],
  booksByUser = new Map(),
  clubsByUser = new Map(),
  genresByUser = new Map(),
  activityByUser = new Map(),
  limit = 12,
}) => {
  const sourceId = normalizeId(sourceUserId);
  const graph = createAdjacency(follows);
  const { distances, previous } = dijkstra(graph, sourceId);
  const followingByUser = new Map();

  follows.forEach((follow) => {
    const follower = normalizeId(follow.followerId);
    const following = normalizeId(follow.followingId);
    const set = followingByUser.get(follower) || new Set();
    set.add(following);
    followingByUser.set(follower, set);
  });

  const sourceFollowing = followingByUser.get(sourceId) || new Set();
  const sourceBooks = booksByUser.get(sourceId) || new Set();
  const sourceClubs = clubsByUser.get(sourceId) || new Set();
  const sourceGenres = genresByUser.get(sourceId) || new Set();

  return users
    .map((user) => {
      const userId = normalizeId(user);
      if (!userId || userId === sourceId || sourceFollowing.has(userId)) return null;

      const candidateFollowing = followingByUser.get(userId) || new Set();
      const mutualConnections = intersectionCount(sourceFollowing, candidateFollowing);
      const sharedBooks = intersectionCount(sourceBooks, booksByUser.get(userId) || new Set());
      const sharedClubs = intersectionCount(sourceClubs, clubsByUser.get(userId) || new Set());
      const sharedGenres = intersectionCount(sourceGenres, genresByUser.get(userId) || new Set());
      const graphDistance = distances.get(userId) ?? Number.POSITIVE_INFINITY;
      const recentActivity = activityByUser.get(userId) || 0;
      const score = calculateCandidateScore({
        graphDistance,
        mutualConnections,
        sharedBooks,
        sharedClubs,
        sharedGenres,
        recentActivity,
      });

      return {
        user,
        userId,
        score,
        graphDistance: Number.isFinite(graphDistance) ? Number(graphDistance.toFixed(2)) : null,
        path: Number.isFinite(graphDistance) ? tracePath(previous, sourceId, userId) : [],
        signals: {
          mutualConnections,
          sharedBooks,
          sharedClubs,
          sharedGenres,
          recentActivity,
        },
        reasons: buildReasons({
          graphDistance,
          mutualConnections,
          sharedBooks,
          sharedClubs,
          sharedGenres,
        }),
      };
    })
    .filter((candidate) => candidate && candidate.score > 0)
    .sort((a, b) => b.score - a.score || (a.graphDistance ?? 99) - (b.graphDistance ?? 99))
    .slice(0, limit);
};

module.exports = {
  buildReasons,
  calculateCandidateScore,
  createAdjacency,
  dijkstra,
  rankReaderCandidates,
  tracePath,
};
