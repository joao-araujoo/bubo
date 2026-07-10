const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const UserBook = require('../models/UserBook');
const DeepReview = require('../models/DeepReview');

const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
};

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      const field = existingUser.email === email ? 'Email' : 'Username';
      return res.status(400).json({ message: `${field} already in use` });
    }
    const user = new User({ username, email, password });
    await user.save();
    const token = generateToken(user._id);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = generateToken(user._id);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  res.json({ user: req.user });
};

exports.updateProfile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { username, avatar, bio, readingGoal } = req.body;

  try {
    if (username && username !== req.user.username) {
      const existing = await User.findOne({ username, _id: { $ne: req.user._id } });
      if (existing) return res.status(400).json({ message: 'Username already in use' });
    }

    const updates = {};
    if (username !== undefined) updates.username = username;
    if (avatar !== undefined) updates.avatar = avatar;
    if (bio !== undefined) updates.bio = bio;
    if (readingGoal !== undefined) updates.readingGoal = readingGoal;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile', error: err.message });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const weekStart = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));

    const [library, reviews, weeklyReviews, premiumReviews] = await Promise.all([
      UserBook.find({ userId }).populate('bookId').sort({ updatedAt: -1 }),
      DeepReview.find({ userId })
        .populate({
          path: 'userBookId',
          populate: { path: 'bookId', select: 'title author coverImage totalPages' }
        })
        .sort({ createdAt: -1 }),
      DeepReview.countDocuments({ userId, createdAt: { $gte: weekStart } }),
      DeepReview.countDocuments({ userId, status: 'approved', cognitiveDepth: { $gte: 85 } })
    ]);

    const approvedReviews = reviews.filter((review) => review.status === 'approved');
    const booksRead = library.filter((item) => item.status === 'read').length;
    const booksReading = library.filter((item) => item.status === 'reading').length;
    const pagesRegistered = library.reduce((sum, item) => sum + Math.max(0, Number(item.currentPage) || 0), 0);
    const depthTotal = approvedReviews.reduce((sum, review) => sum + (Number(review.cognitiveDepth) || 0), 0);
    const averageDepth = approvedReviews.length > 0 ? Math.round(depthTotal / approvedReviews.length) : 0;
    const maxDepth = approvedReviews.reduce((maximum, review) => Math.max(maximum, Number(review.cognitiveDepth) || 0), 0);
    const xp = (approvedReviews.length * 100) + (booksRead * 250) + pagesRegistered;
    const annualGoal = Number(req.user.readingGoal) || 20;

    const recentReviews = reviews.slice(0, 10).map((review) => ({
      _id: review._id,
      title: review.userBookId?.bookId?.title || 'Livro removido',
      author: review.userBookId?.bookId?.author || '',
      coverImage: review.userBookId?.bookId?.coverImage || '',
      pageFrom: review.pageFrom,
      pageTo: review.pageTo,
      cognitiveDepth: review.cognitiveDepth,
      status: review.status,
      feedback: review.aiResponse?.feedback || '',
      encouragement: review.aiResponse?.encouragement || '',
      createdAt: review.createdAt
    }));

    res.json({
      user: req.user,
      stats: {
        booksTotal: library.length,
        booksRead,
        booksReading,
        reviewsTotal: reviews.length,
        approvedReviews: approvedReviews.length,
        pagesRegistered,
        averageDepth,
        maxDepth,
        xp,
        annualGoal
      },
      challenges: [
        {
          id: 'annual_goal',
          title: 'Meta anual',
          description: 'Concluir livros mantendo histórico reflexivo.',
          current: booksRead,
          target: annualGoal,
          xp: 350
        },
        {
          id: 'deep_week',
          title: 'Semana profunda',
          description: 'Fazer 3 Deep Reviews em 7 dias.',
          current: weeklyReviews,
          target: 3,
          xp: 180
        },
        {
          id: 'premium_synthesis',
          title: 'Síntese premium',
          description: 'Alcançar 5 reviews com nota 85+.',
          current: premiumReviews,
          target: 5,
          xp: 240
        }
      ],
      recentReviews
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get dashboard', error: err.message });
  }
};
