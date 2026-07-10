const SocialActivity = require('../models/SocialActivity');

const SEED_ACTIVITIES = [
  {
    _id: 'seed-review-dune',
    username: 'elena_reads',
    avatar: '',
    message: 'Validou 45 páginas de “Duna” com uma síntese sobre ecologia, poder e sobrevivência.',
    insight: 'O ambiente também é personagem quando condiciona todas as escolhas possíveis.',
    cognitiveDepth: 94,
    type: 'review_approved',
    postType: 'review',
    bookTitle: 'Duna',
    createdAt: new Date(Date.now() - 3600000),
    isOwn: false
  },
  {
    _id: 'seed-review-meditations',
    username: 'marcus_thinks',
    avatar: '',
    message: 'Conectou disciplina, desejo e responsabilidade em uma Deep Review de “Meditações”.',
    insight: 'Controlar a resposta é diferente de controlar o acontecimento.',
    cognitiveDepth: 88,
    type: 'review_approved',
    postType: 'review',
    bookTitle: 'Meditações',
    createdAt: new Date(Date.now() - 7200000),
    isOwn: false
  }
];

const serializeActivity = (activity, currentUserId) => ({
  _id: activity._id,
  username: activity.userId?.username || 'Leitor Bubo',
  avatar: activity.userId?.avatar || '',
  message: activity.message,
  insight: activity.insight || '',
  cognitiveDepth: activity.cognitiveDepth || 0,
  type: activity.type,
  postType: activity.postType || 'free',
  bookTitle: activity.bookId?.title || '',
  createdAt: activity.createdAt,
  isOwn: Boolean(activity.userId?._id && String(activity.userId._id) === String(currentUserId))
});

exports.getFeed = async (req, res) => {
  try {
    const activities = await SocialActivity.find()
      .populate('userId', 'username avatar')
      .populate('bookId', 'title author coverImage')
      .sort({ createdAt: -1 })
      .limit(50);

    const serialized = activities.map((activity) => serializeActivity(activity, req.user._id));
    res.json({ activities: serialized.length > 0 ? serialized : SEED_ACTIVITIES });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get feed', error: err.message });
  }
};

exports.createActivity = async (req, res) => {
  const { type = 'post', postType = 'free', bookId, pages, cognitiveDepth, message, insight } = req.body;

  if (type !== 'post') {
    return res.status(400).json({ message: 'Only reader posts can be created from this endpoint' });
  }

  const normalizedMessage = String(message || '').trim();
  const normalizedInsight = String(insight || '').trim();

  if (!normalizedMessage) {
    return res.status(400).json({ message: 'Post content is required' });
  }

  try {
    const activity = await SocialActivity.create({
      userId: req.user._id,
      type: 'post',
      postType,
      bookId: bookId || undefined,
      pages: Number(pages) || 0,
      cognitiveDepth: Number(cognitiveDepth) || 0,
      message: normalizedMessage,
      insight: normalizedInsight
    });

    const populated = await SocialActivity.findById(activity._id)
      .populate('userId', 'username avatar')
      .populate('bookId', 'title author coverImage');

    res.status(201).json({ activity: serializeActivity(populated, req.user._id) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create activity', error: err.message });
  }
};
