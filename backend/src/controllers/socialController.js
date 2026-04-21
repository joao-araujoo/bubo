const SocialActivity = require('../models/SocialActivity');
const User = require('../models/User');

const SEED_ACTIVITIES = [
  { username: 'elena_reads', message: 'validated 45 pages of "Dune" with 94% Cognitive Depth', cognitiveDepth: 94, type: 'review_approved', createdAt: new Date(Date.now() - 3600000) },
  { username: 'marcus_thinks', message: 'validated 30 pages of "Meditations" with 88% Cognitive Depth', cognitiveDepth: 88, type: 'review_approved', createdAt: new Date(Date.now() - 7200000) },
  { username: 'sophie_w', message: 'finished "The Name of the Rose" — a true bibliophile achievement!', cognitiveDepth: 0, type: 'book_completed', createdAt: new Date(Date.now() - 14400000) },
  { username: 'daniel_v', message: 'validated 60 pages of "Thinking, Fast and Slow" with 91% Cognitive Depth', cognitiveDepth: 91, type: 'review_approved', createdAt: new Date(Date.now() - 86400000) },
  { username: 'aisha_reads', message: 'added "The Brothers Karamazov" to their library', cognitiveDepth: 0, type: 'book_added', createdAt: new Date(Date.now() - 172800000) }
];

exports.getFeed = async (req, res) => {
  try {
    const activities = await SocialActivity.find()
      .populate('userId', 'username avatar')
      .populate('bookId', 'title')
      .sort({ createdAt: -1 })
      .limit(50);

    const realActivities = activities.map((a) => ({
      _id: a._id,
      username: a.userId?.username || 'Unknown',
      avatar: a.userId?.avatar || '',
      message: a.message,
      cognitiveDepth: a.cognitiveDepth,
      type: a.type,
      createdAt: a.createdAt
    }));

    const combined = realActivities.length > 0 ? realActivities : SEED_ACTIVITIES;

    res.json({ activities: combined });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get feed', error: err.message });
  }
};

exports.createActivity = async (req, res) => {
  const { type, bookId, pages, cognitiveDepth, message } = req.body;
  try {
    const activity = new SocialActivity({ userId: req.user._id, type, bookId, pages, cognitiveDepth, message });
    await activity.save();
    res.status(201).json({ activity });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create activity', error: err.message });
  }
};
