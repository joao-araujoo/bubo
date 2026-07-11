const User = require('../models/User');
const DeepReview = require('../models/DeepReview');
const UserBook = require('../models/UserBook');
const SocialActivity = require('../models/SocialActivity');

const ACHIEVEMENTS = [
  { id: 'first_review', name: 'Primeiro passo', description: 'Conclua sua primeira Deep Review.', iconKey: 'sparkles', threshold: 1, type: 'reviews', rarity: 'common' },
  { id: 'ten_reviews', name: 'Leitura profunda', description: 'Conclua 10 Deep Reviews.', iconKey: 'target', threshold: 10, type: 'reviews', rarity: 'rare' },
  { id: 'fifty_reviews', name: 'Leitor reflexivo', description: 'Conclua 50 Deep Reviews.', iconKey: 'brain', threshold: 50, type: 'reviews', rarity: 'legendary' },
  { id: 'first_book', name: 'Primeiro livro', description: 'Finalize seu primeiro livro.', iconKey: 'book_open', threshold: 1, type: 'books_completed', rarity: 'common' },
  { id: 'five_books', name: 'Biblioteca viva', description: 'Finalize 5 livros.', iconKey: 'library', threshold: 5, type: 'books_completed', rarity: 'epic' },
  { id: 'high_depth', name: 'Síntese premium', description: 'Alcance 90 ou mais de profundidade cognitiva.', iconKey: 'medal', threshold: 90, type: 'max_depth', rarity: 'epic' },
  { id: 'streak_7', name: 'Semana ativa', description: 'Mantenha uma sequência de leitura por 7 dias.', iconKey: 'flame', threshold: 7, type: 'streak', rarity: 'rare' },
  { id: 'hundred_pages', name: 'Cem páginas', description: 'Registre 100 páginas validadas.', iconKey: 'book_open', threshold: 100, type: 'total_pages', rarity: 'rare' },
];

const getMetrics = async (userId) => {
  const [approvedReviews, completedBooks, maxDepthDoc, totalPagesResult] = await Promise.all([
    DeepReview.countDocuments({ userId, status: 'approved' }),
    UserBook.countDocuments({ userId, status: 'read' }),
    DeepReview.findOne({ userId, status: 'approved' }).sort({ cognitiveDepth: -1 }),
    DeepReview.aggregate([
      { $match: { userId } },
      { $match: { status: 'approved' } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$pageTo', '$pageFrom'] } } } },
    ]),
  ]);

  return {
    reviews: approvedReviews,
    books_completed: completedBooks,
    max_depth: maxDepthDoc?.cognitiveDepth || 0,
    streak: 0,
    total_pages: totalPagesResult[0]?.total || 0,
  };
};

const getCurrentValue = (achievement, metrics) => metrics[achievement.type] || 0;

exports.getUserAchievements = async (req, res) => {
  try {
    await exports.checkAndUnlockAchievements(req.user._id);
    const [user, metrics] = await Promise.all([
      User.findById(req.user._id),
      getMetrics(req.user._id),
    ]);

    const unlocked = new Set(user?.achievements || []);
    const achievements = ACHIEVEMENTS.map((achievement) => {
      const current = getCurrentValue(achievement, metrics);
      return {
        ...achievement,
        current,
        progress: Math.min(100, Math.round((current / achievement.threshold) * 100)),
        unlocked: unlocked.has(achievement.id),
      };
    });

    res.json({ achievements, metrics });
  } catch (err) {
    res.status(500).json({ message: 'Não foi possível carregar as conquistas.', error: err.message });
  }
};

exports.checkAndUnlockAchievements = async (userId) => {
  try {
    const [user, metrics] = await Promise.all([
      User.findById(userId),
      getMetrics(userId),
    ]);

    if (!user) return [];

    const unlocked = new Set(user.achievements || []);
    const newlyUnlocked = [];

    for (const achievement of ACHIEVEMENTS) {
      if (unlocked.has(achievement.id)) continue;
      const current = getCurrentValue(achievement, metrics);
      if (current >= achievement.threshold) {
        unlocked.add(achievement.id);
        newlyUnlocked.push(achievement.id);
      }
    }

    if (newlyUnlocked.length > 0) {
      await User.findByIdAndUpdate(userId, { achievements: Array.from(unlocked) });
      await SocialActivity.insertMany(newlyUnlocked.map((achievementId) => {
        const achievement = ACHIEVEMENTS.find((item) => item.id === achievementId);
        return {
          userId,
          type: 'achievement_unlocked',
          message: `Desbloqueou a conquista “${achievement.name}”.`,
        };
      }));
    }

    return newlyUnlocked;
  } catch (err) {
    console.error('Achievement check error:', err);
    return [];
  }
};
