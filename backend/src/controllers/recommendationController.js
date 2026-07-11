const ClubMembership = require('../models/ClubMembership');
const SocialActivity = require('../models/SocialActivity');
const User = require('../models/User');
const UserBook = require('../models/UserBook');
const UserFollow = require('../models/UserFollow');
const { rankReaderCandidates } = require('../services/social/recommendationGraph');

const MAX_USERS = 300;
const MAX_FOLLOWS = 5000;
const MAX_RECOMMENDATIONS = 12;

const normalizeId = (value) => String(value?._id || value || '');

const buildSetMap = (records, userField, valueField) => {
  const map = new Map();
  records.forEach((record) => {
    const userId = normalizeId(record[userField]);
    const value = normalizeId(record[valueField]);
    if (!userId || !value) return;
    const set = map.get(userId) || new Set();
    set.add(value);
    map.set(userId, set);
  });
  return map;
};

exports.getReaderRecommendations = async (req, res) => {
  try {
    const sourceUserId = String(req.user._id);
    const existingFollows = await UserFollow.find({ followerId: req.user._id })
      .select('followingId')
      .lean();
    const excludedIds = [req.user._id, ...existingFollows.map((item) => item.followingId)];

    const [sourceUser, candidates, follows] = await Promise.all([
      User.findById(req.user._id).select('readingPreferences').lean(),
      User.find({
        _id: { $nin: excludedIds },
        onboardingCompleted: true,
      })
        .select('username avatar bio readingGoal readingPreferences createdAt')
        .sort({ createdAt: -1 })
        .limit(MAX_USERS)
        .lean(),
      UserFollow.find()
        .select('followerId followingId')
        .sort({ createdAt: -1 })
        .limit(MAX_FOLLOWS)
        .lean(),
    ]);

    if (!candidates.length) {
      return res.json({ recommendations: [], meta: { algorithm: 'dijkstra-hybrid-v1', candidatesEvaluated: 0 } });
    }

    const candidateIds = candidates.map((candidate) => candidate._id);
    const relevantUserIds = [req.user._id, ...candidateIds];

    const [userBooks, clubMemberships, activities] = await Promise.all([
      UserBook.find({ userId: { $in: relevantUserIds } }).select('userId bookId').lean(),
      ClubMembership.find({ userId: { $in: relevantUserIds } }).select('userId clubId').lean(),
      SocialActivity.aggregate([
        { $match: { userId: { $in: candidateIds } } },
        { $group: { _id: '$userId', count: { $sum: 1 }, lastActivityAt: { $max: '$createdAt' } } },
      ]),
    ]);

    const booksByUser = buildSetMap(userBooks, 'userId', 'bookId');
    const clubsByUser = buildSetMap(clubMemberships, 'userId', 'clubId');
    const genresByUser = new Map();
    genresByUser.set(
      sourceUserId,
      new Set((sourceUser?.readingPreferences?.favoriteGenres || []).map((genre) => String(genre).toLowerCase())),
    );
    candidates.forEach((candidate) => {
      genresByUser.set(
        String(candidate._id),
        new Set((candidate.readingPreferences?.favoriteGenres || []).map((genre) => String(genre).toLowerCase())),
      );
    });

    const activityByUser = new Map(
      activities.map((activity) => [String(activity._id), Math.min(5, Number(activity.count) || 0)]),
    );

    const ranked = rankReaderCandidates({
      sourceUserId,
      users: candidates,
      follows,
      booksByUser,
      clubsByUser,
      genresByUser,
      activityByUser,
      limit: Math.min(Math.max(Number(req.query.limit) || 8, 1), MAX_RECOMMENDATIONS),
    });

    const recommendations = ranked.map((candidate) => ({
      user: {
        _id: candidate.user._id,
        username: candidate.user.username,
        avatar: candidate.user.avatar || '',
        bio: candidate.user.bio || '',
        readingGoal: candidate.user.readingGoal || 0,
        favoriteGenres: candidate.user.readingPreferences?.favoriteGenres || [],
      },
      score: candidate.score,
      graphDistance: candidate.graphDistance,
      reasons: candidate.reasons,
      signals: candidate.signals,
      isFollowing: false,
    }));

    res.json({
      recommendations,
      meta: {
        algorithm: 'dijkstra-hybrid-v1',
        candidatesEvaluated: candidates.length,
        graphEdgesEvaluated: follows.length,
        explanation: 'Distância no grafo combinada com conexões, clubes, livros e gêneros compartilhados.',
      },
    });
  } catch (error) {
    console.error('Reader recommendation error:', error);
    res.status(500).json({
      message: 'Não foi possível calcular leitores próximos agora. O restante da rede social continua disponível.',
      code: 'READER_RECOMMENDATIONS_FAILED',
    });
  }
};
