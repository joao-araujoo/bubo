const UserBook = require('../models/UserBook');
const DeepReview = require('../models/DeepReview');
const SocialActivity = require('../models/SocialActivity');
const achievementController = require('./achievementController');
const logger = require('../utils/logger');
const {
  evaluateDeepReview,
  getReadingCoachStatus,
} = require('../services/ai/readingCoach');

const MAX_REVIEW_LENGTH = 12000;
const CRITERIA_LABELS = {
  comprehension: 'Compreensão',
  specificity: 'Especificidade',
  connections: 'Conexões',
  reflection: 'Reflexão',
};

const average = (values) => {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length);
};

const validatePages = ({ pageFrom, pageTo, currentPage, totalPages }) => {
  if (!Number.isInteger(pageFrom) || !Number.isInteger(pageTo)) {
    return 'As páginas precisam ser números inteiros.';
  }
  if (pageFrom < 1 || pageTo < pageFrom) {
    return 'O intervalo de páginas é inválido.';
  }
  if (pageFrom <= currentPage) {
    return `A página inicial deve ser maior que a página atual (${currentPage}).`;
  }
  if (totalPages && pageTo > totalPages) {
    return `A página final não pode ultrapassar ${totalPages}.`;
  }
  return null;
};

exports.getCoachStatus = async (req, res) => {
  res.json({ coach: getReadingCoachStatus() });
};

exports.submitReview = async (req, res) => {
  const userBookId = req.body.userBookId;
  const pageFrom = Number.parseInt(req.body.pageFrom, 10);
  const pageTo = Number.parseInt(req.body.pageTo, 10);
  const reviewText = String(req.body.reviewText || '').trim();

  if (!userBookId || !reviewText) {
    return res.status(400).json({ message: 'Preencha o livro, o intervalo de páginas e a síntese.' });
  }
  if (reviewText.length > MAX_REVIEW_LENGTH) {
    return res.status(400).json({ message: `A síntese deve ter no máximo ${MAX_REVIEW_LENGTH} caracteres.` });
  }

  try {
    const userBook = await UserBook.findOne({
      _id: userBookId,
      userId: req.user._id,
    }).populate('bookId');
    if (!userBook) return res.status(404).json({ message: 'Livro não encontrado no seu acervo.' });

    const book = userBook.bookId;
    const totalPages = Number(userBook.totalPagesOverride)
      || Number(book.totalPages)
      || 0;
    const pageError = validatePages({
      pageFrom,
      pageTo,
      currentPage: Number(userBook.currentPage || 0),
      totalPages,
    });
    if (pageError) return res.status(400).json({ message: pageError });

    const { result: aiResult, meta } = await evaluateDeepReview({
      book: {
        ...book.toObject(),
        totalPages,
      },
      pageFrom,
      pageTo,
      reviewText,
    });
    const status = aiResult.state === 'APPROVED' ? 'approved' : 'guiding';
    const cognitiveDepth = status === 'approved' ? aiResult.cognitiveDepth : 0;
    const persistedAiResponse = {
      ...aiResult,
      meta,
    };

    const deepReview = await DeepReview.create({
      userId: req.user._id,
      userBookId,
      pageFrom,
      pageTo,
      reviewText,
      cognitiveDepth,
      status,
      aiProvider: meta.provider,
      aiModel: meta.model,
      evaluationVersion: meta.evaluationVersion,
      wordCount: aiResult.wordCount,
      aiResponse: persistedAiResponse,
    });

    if (status === 'approved') {
      await UserBook.findByIdAndUpdate(userBookId, {
        $max: { currentPage: pageTo },
        $set: { updatedAt: new Date() },
        $inc: { deepReviewCount: 1 },
        $push: {
          deepReviews: {
            pageFrom,
            pageTo,
            reviewText,
            cognitiveDepth,
            status,
            aiResponse: persistedAiResponse,
          },
        },
      });

      const pagesValidated = pageTo - pageFrom + 1;
      await SocialActivity.create({
        userId: req.user._id,
        type: 'review_approved',
        bookId: book._id,
        pages: pagesValidated,
        cognitiveDepth,
        message: `Validou ${pagesValidated} páginas de “${book.title}” com ${cognitiveDepth} de profundidade cognitiva.`,
        insight: aiResult.retentionPrompt || '',
      });

      await achievementController.checkAndUnlockAchievements(req.user._id);
    }

    const responseResult = {
      ...aiResult,
      meta,
    };
    res.json({
      review: deepReview,
      deepReview,
      aiResult: responseResult,
    });
  } catch (err) {
    logger.error('deep_review_failed', {
      requestId: req.requestId,
      userId: req.user?._id,
      userBookId,
      error: err,
    });
    if (err.code === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ message: err.message, code: err.code });
    }
    if (err.code === 'AI_PROVIDER_UNAVAILABLE' || err.code === 'AI_EMPTY_RESPONSE') {
      return res.status(503).json({ message: err.message, code: err.code });
    }
    res.status(500).json({
      message: 'Não foi possível validar a Deep Review agora. Sua escrita não foi apagada; tente novamente.',
      code: 'DEEP_REVIEW_FAILED',
    });
  }
};

exports.getReviewHistory = async (req, res) => {
  const { userBookId } = req.params;
  try {
    const userBook = await UserBook.exists({
      _id: userBookId,
      userId: req.user._id,
    });
    if (!userBook) return res.status(404).json({ message: 'Livro não encontrado no seu acervo.' });

    const reviews = await DeepReview.find({
      userId: req.user._id,
      userBookId,
    }).sort({ createdAt: -1 });
    res.json({ reviews });
  } catch (err) {
    res.status(500).json({ message: 'Não foi possível carregar o histórico de reviews.' });
  }
};

exports.getCognitiveProfile = async (req, res) => {
  try {
    const reviews = await DeepReview.find({ userId: req.user._id })
      .populate({
        path: 'userBookId',
        select: 'bookId currentPage',
        populate: { path: 'bookId', select: 'title author' },
      })
      .sort({ createdAt: 1 })
      .lean();

    const approved = reviews.filter((review) => review.status === 'approved');
    const depthValues = approved.map((review) => review.cognitiveDepth || 0);
    const criteriaValues = {
      comprehension: [],
      specificity: [],
      connections: [],
      reflection: [],
    };

    approved.forEach((review) => {
      const criteria = review.aiResponse?.criteria || {};
      Object.keys(criteriaValues).forEach((key) => {
        if (Number.isFinite(Number(criteria[key]))) criteriaValues[key].push(Number(criteria[key]));
      });
    });

    const criteria = Object.fromEntries(
      Object.entries(criteriaValues).map(([key, values]) => [key, average(values)]),
    );
    const rankedCriteria = Object.entries(criteria)
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]);

    const recentDepth = depthValues.slice(-3);
    const previousDepth = depthValues.slice(-6, -3);
    const recentAverage = average(recentDepth);
    const previousAverage = average(previousDepth);
    const delta = previousDepth.length > 0 ? recentAverage - previousAverage : 0;
    const trend = depthValues.length < 3
      ? 'collecting'
      : delta >= 4
        ? 'improving'
        : delta <= -4
          ? 'declining'
          : 'stable';

    const booksMap = new Map();
    approved.forEach((review) => {
      const book = review.userBookId?.bookId;
      const key = String(book?._id || review.userBookId?._id || 'unknown');
      const current = booksMap.get(key) || {
        bookId: book?._id || null,
        title: book?.title || 'Livro não identificado',
        author: book?.author || '',
        depths: [],
        reviews: 0,
        lastReviewAt: null,
        retentionPrompts: [],
      };
      current.depths.push(review.cognitiveDepth || 0);
      current.reviews += 1;
      current.lastReviewAt = review.createdAt;
      if (review.aiResponse?.retentionPrompt) current.retentionPrompts.push(review.aiResponse.retentionPrompt);
      booksMap.set(key, current);
    });

    const books = [...booksMap.values()]
      .map((item) => ({
        bookId: item.bookId,
        title: item.title,
        author: item.author,
        reviews: item.reviews,
        averageDepth: average(item.depths),
        lastReviewAt: item.lastReviewAt,
        retentionPrompt: item.retentionPrompts.at(-1) || '',
      }))
      .sort((a, b) => new Date(b.lastReviewAt) - new Date(a.lastReviewAt));

    const weakest = [...rankedCriteria].sort((a, b) => a[1] - b[1])[0];
    const recommendationByKey = {
      comprehension: 'Depois de ler, explique o trecho em três frases sem consultar o livro.',
      specificity: 'Inclua pelo menos uma evidência concreta do trecho em sua próxima Deep Review.',
      connections: 'Relacione a próxima leitura a outra parte do livro ou a um conhecimento anterior.',
      reflection: 'Termine a próxima síntese com uma tensão, interpretação ou pergunta própria.',
    };

    res.json({
      coach: getReadingCoachStatus(),
      summary: {
        totalReviews: reviews.length,
        approvedReviews: approved.length,
        guidingReviews: reviews.length - approved.length,
        averageDepth: average(depthValues),
        highestDepth: depthValues.length > 0 ? Math.max(...depthValues) : 0,
        recentAverage,
        trend,
        trendDelta: delta,
      },
      dimensions: Object.fromEntries(
        Object.entries(criteria).map(([key, value]) => [key, {
          label: CRITERIA_LABELS[key],
          score: value,
        }]),
      ),
      strongestDimension: rankedCriteria[0]
        ? { key: rankedCriteria[0][0], label: CRITERIA_LABELS[rankedCriteria[0][0]], score: rankedCriteria[0][1] }
        : null,
      growthDimension: weakest
        ? { key: weakest[0], label: CRITERIA_LABELS[weakest[0]], score: weakest[1] }
        : null,
      recommendation: weakest
        ? recommendationByKey[weakest[0]]
        : 'Faça sua primeira Deep Review para o Bubo começar a mapear seu padrão cognitivo.',
      books,
    });
  } catch (err) {
    logger.error('cognitive_profile_failed', {
      requestId: req.requestId,
      userId: req.user?._id,
      error: err,
    });
    res.status(500).json({ message: 'Não foi possível calcular seu perfil cognitivo.' });
  }
};
