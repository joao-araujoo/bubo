const User = require('../models/User');
const DeepReview = require('../models/DeepReview');
const UserBook = require('../models/UserBook');
const SocialActivity = require('../models/SocialActivity');

const ACHIEVEMENTS = [
  { id: 'first_review', name: 'First Steps', description: 'Complete your first Deep Review', icon: '🦉', threshold: 1, type: 'reviews' },
  { id: 'ten_reviews', name: 'Deep Diver', description: 'Complete 10 Deep Reviews', icon: '🎯', threshold: 10, type: 'reviews' },
  { id: 'fifty_reviews', name: 'Philosopher', description: 'Complete 50 Deep Reviews', icon: '🧠', threshold: 50, type: 'reviews' },
  { id: 'first_book', name: 'Bookworm', description: 'Finish your first book', icon: '📚', threshold: 1, type: 'books_completed' },
  { id: 'five_books', name: 'Bibliophile', description: 'Finish 5 books', icon: '🏛️', threshold: 5, type: 'books_completed' },
  { id: 'high_depth', name: 'Cognitive Elite', description: 'Achieve 90%+ Cognitive Depth score', icon: '⚡', threshold: 90, type: 'max_depth' },
  { id: 'streak_7', name: 'Consistent Reader', description: '7-day reading streak', icon: '🔥', threshold: 7, type: 'streak' },
  { id: 'hundred_pages', name: 'Century', description: 'Read 100 pages total', icon: '💯', threshold: 100, type: 'total_pages' }
];

exports.getUserAchievements = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const unlocked = user.achievements || [];
    const result = ACHIEVEMENTS.map((a) => ({ ...a, unlocked: unlocked.includes(a.id) }));
    res.json({ achievements: result });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get achievements', error: err.message });
  }
};

exports.checkAndUnlockAchievements = async (userId) => {
  try {
    const user = await User.findById(userId);
    const unlocked = new Set(user.achievements || []);
    const newlyUnlocked = [];

    const approvedReviews = await DeepReview.countDocuments({ userId, status: 'approved' });
    const completedBooks = await UserBook.countDocuments({ userId, status: 'read' });
    const maxDepthDoc = await DeepReview.findOne({ userId, status: 'approved' }).sort({ cognitiveDepth: -1 });
    const maxDepth = maxDepthDoc ? maxDepthDoc.cognitiveDepth : 0;

    const totalPagesResult = await DeepReview.aggregate([
      { $match: { userId: user._id, status: 'approved' } },
      { $group: { _id: null, total: { $sum: { $subtract: ['$pageTo', '$pageFrom'] } } } }
    ]);
    const totalPages = totalPagesResult.length > 0 ? totalPagesResult[0].total : 0;

    for (const ach of ACHIEVEMENTS) {
      if (unlocked.has(ach.id)) continue;
      let earned = false;
      if (ach.type === 'reviews' && approvedReviews >= ach.threshold) earned = true;
      if (ach.type === 'books_completed' && completedBooks >= ach.threshold) earned = true;
      if (ach.type === 'max_depth' && maxDepth >= ach.threshold) earned = true;
      if (ach.type === 'total_pages' && totalPages >= ach.threshold) earned = true;
      if (earned) {
        unlocked.add(ach.id);
        newlyUnlocked.push(ach.id);
      }
    }

    if (newlyUnlocked.length > 0) {
      await User.findByIdAndUpdate(userId, { achievements: Array.from(unlocked) });
      for (const achId of newlyUnlocked) {
        const ach = ACHIEVEMENTS.find((a) => a.id === achId);
        await SocialActivity.create({
          userId,
          type: 'achievement_unlocked',
          message: `unlocked the "${ach.name}" achievement ${ach.icon}`
        });
      }
    }

    return newlyUnlocked;
  } catch (err) {
    console.error('Achievement check error:', err);
    return [];
  }
};
