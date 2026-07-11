const mongoose = require('mongoose');
const DeepReview = require('../models/DeepReview');
const ReadingSession = require('../models/ReadingSession');
const SocialActivity = require('../models/SocialActivity');
const UserBook = require('../models/UserBook');
const { normalizeReadingSessionInput } = require('../services/reading/readingSessionRules');

const MAX_SESSIONS = 50;
const MAX_REVIEWS = 30;

const effectiveTotalPages = (userBook) => Number(userBook.totalPagesOverride)
  || Number(userBook.bookId?.totalPages)
  || 0;

const invalidIdResponse = (res) => res.status(400).json({
  message: 'O identificador desta leitura é inválido.',
  code: 'USER_BOOK_ID_INVALID',
});

exports.getBookDetail = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return invalidIdResponse(res);

  try {
    const userBook = await UserBook.findOne({ _id: id, userId: req.user._id })
      .select('-deepReviews')
      .populate('bookId')
      .lean();

    if (!userBook) {
      return res.status(404).json({
        message: 'Livro não encontrado no seu acervo.',
        code: 'USER_BOOK_NOT_FOUND',
      });
    }

    const [sessions, reviews, sessionStats] = await Promise.all([
      ReadingSession.find({ userId: req.user._id, userBookId: userBook._id })
        .sort({ readAt: -1, createdAt: -1 })
        .limit(MAX_SESSIONS)
        .lean(),
      DeepReview.find({ userId: req.user._id, userBookId: userBook._id })
        .select('pageFrom pageTo reviewText cognitiveDepth status aiProvider aiModel evaluationVersion wordCount aiResponse createdAt')
        .sort({ createdAt: -1 })
        .limit(MAX_REVIEWS)
        .lean(),
      ReadingSession.aggregate([
        { $match: { userId: req.user._id, userBookId: userBook._id } },
        {
          $group: {
            _id: null,
            sessionCount: { $sum: 1 },
            pagesRead: { $sum: '$pagesRead' },
            durationMinutes: { $sum: '$durationMinutes' },
            lastSessionAt: { $max: '$readAt' },
          },
        },
      ]),
    ]);

    const totalPages = effectiveTotalPages(userBook);
    const currentPage = Math.max(0, Number(userBook.currentPage) || 0);
    const stats = sessionStats[0] || {};
    const approvedReviews = reviews.filter((review) => review.status === 'approved');

    res.setHeader('Cache-Control', 'private, no-store');
    return res.json({
      userBook: {
        ...userBook,
        effectiveTotalPages: totalPages,
      },
      sessions,
      reviews,
      summary: {
        progressPercent: totalPages > 0 ? Math.min(100, Math.round((currentPage / totalPages) * 100)) : 0,
        sessionCount: Number(stats.sessionCount) || 0,
        pagesReadInSessions: Number(stats.pagesRead) || 0,
        durationMinutes: Number(stats.durationMinutes) || 0,
        lastSessionAt: stats.lastSessionAt || null,
        reviewCount: reviews.length,
        approvedReviewCount: approvedReviews.length,
        averageDepth: approvedReviews.length > 0
          ? Math.round(approvedReviews.reduce((sum, review) => sum + Number(review.cognitiveDepth || 0), 0) / approvedReviews.length)
          : 0,
      },
      meta: {
        sessionLimit: MAX_SESSIONS,
        reviewLimit: MAX_REVIEWS,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Não foi possível carregar esta leitura agora.',
      code: 'BOOK_DETAIL_LOAD_FAILED',
    });
  }
};

exports.createReadingSession = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) return invalidIdResponse(res);

  let session;
  try {
    const existing = await UserBook.findOne({ _id: id, userId: req.user._id }).populate('bookId');
    if (!existing) {
      return res.status(404).json({
        message: 'Livro não encontrado no seu acervo.',
        code: 'USER_BOOK_NOT_FOUND',
      });
    }

    const totalPages = effectiveTotalPages(existing);
    const input = normalizeReadingSessionInput(req.body, {
      currentPage: existing.currentPage,
      totalPages,
    });

    session = await ReadingSession.create({
      userId: req.user._id,
      userBookId: existing._id,
      ...input,
    });

    const now = new Date();
    const nextCurrentPage = Math.max(Number(existing.currentPage) || 0, input.pageTo);
    const completed = totalPages > 0 && nextCurrentPage >= totalPages;
    const nextStatus = completed ? 'read' : 'reading';

    const userBook = await UserBook.findOneAndUpdate(
      { _id: existing._id, userId: req.user._id },
      {
        $set: {
          currentPage: nextCurrentPage,
          status: nextStatus,
          startedAt: existing.startedAt || input.readAt || now,
          completedAt: completed ? (existing.completedAt || now) : null,
          updatedAt: now,
        },
      },
      { new: true, runValidators: true },
    )
      .select('-deepReviews')
      .populate('bookId')
      .lean();

    if (completed && existing.status !== 'read') {
      await SocialActivity.create({
        userId: req.user._id,
        type: 'book_completed',
        bookId: existing.bookId?._id,
        pages: totalPages || nextCurrentPage,
        message: `Concluiu a leitura de “${existing.bookId?.title || 'um livro'}”.`,
      });
    }

    return res.status(201).json({ session: session.toObject(), userBook });
  } catch (error) {
    if (session?._id) await ReadingSession.deleteOne({ _id: session._id }).catch(() => {});
    if (error.status === 400) {
      return res.status(400).json({ message: error.message, code: error.code });
    }
    return res.status(500).json({
      message: 'Não foi possível registrar esta sessão. Seu progresso anterior foi preservado.',
      code: 'READING_SESSION_CREATE_FAILED',
    });
  }
};

exports.deleteReadingSession = async (req, res) => {
  const { id, sessionId } = req.params;
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(sessionId)) {
    return res.status(400).json({
      message: 'O identificador da sessão é inválido.',
      code: 'READING_SESSION_ID_INVALID',
    });
  }

  try {
    const deleted = await ReadingSession.findOneAndDelete({
      _id: sessionId,
      userBookId: id,
      userId: req.user._id,
    });
    if (!deleted) {
      return res.status(404).json({
        message: 'Sessão de leitura não encontrada.',
        code: 'READING_SESSION_NOT_FOUND',
      });
    }
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({
      message: 'Não foi possível remover a sessão agora.',
      code: 'READING_SESSION_DELETE_FAILED',
    });
  }
};
