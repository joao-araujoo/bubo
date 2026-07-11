const crypto = require('crypto');
const DeepReview = require('../../models/DeepReview');
const DeepReviewSubmission = require('../../models/DeepReviewSubmission');
const SocialActivity = require('../../models/SocialActivity');
const UserBook = require('../../models/UserBook');
const achievementController = require('../../controllers/achievementController');
const { evaluateDeepReview } = require('../ai/readingCoach');
const logger = require('../../utils/logger');

const DEFAULT_LEASE_MS = 2 * 60 * 1000;
const RETRYABLE_CODES = new Set([
  'AI_PROVIDER_UNAVAILABLE',
  'AI_EMPTY_RESPONSE',
  'DEEP_REVIEW_ALREADY_PROCESSING',
]);
const NON_RETRYABLE_CODES = new Set([
  'AI_NOT_CONFIGURED',
  'DEEP_REVIEW_SUBMISSION_NOT_FOUND',
  'DEEP_REVIEW_BOOK_NOT_FOUND',
  'DEEP_REVIEW_INVALID_SUBMISSION',
]);

const createProcessingToken = () => crypto.randomUUID();

const safeErrorCode = (error) => {
  const value = String(error?.code || '').toUpperCase();
  return /^[A-Z0-9_]{3,100}$/.test(value) ? value : 'DEEP_REVIEW_PROCESSING_FAILED';
};

const safeErrorMessage = (error) => {
  const code = safeErrorCode(error);
  if (code === 'AI_NOT_CONFIGURED') {
    return 'A IA do Bubo ainda não foi configurada.';
  }
  if (code === 'AI_PROVIDER_UNAVAILABLE' || code === 'AI_EMPTY_RESPONSE') {
    return 'O serviço de IA está temporariamente indisponível.';
  }
  if (code === 'DEEP_REVIEW_BOOK_NOT_FOUND') {
    return 'O livro desta submissão não está mais disponível no acervo.';
  }
  if (code === 'DEEP_REVIEW_INVALID_SUBMISSION') {
    return 'A submissão não possui dados válidos para processamento.';
  }
  return 'Não foi possível processar a Deep Review agora.';
};

const isRetryableError = (error) => {
  const code = safeErrorCode(error);
  if (NON_RETRYABLE_CODES.has(code)) return false;
  if (RETRYABLE_CODES.has(code)) return true;
  return true;
};

const createProcessingError = (message, code, retryable = false) => {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  return error;
};

const claimSubmission = async (submissionId, leaseMs = DEFAULT_LEASE_MS) => {
  const now = new Date();
  const processingToken = createProcessingToken();
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);

  const claimed = await DeepReviewSubmission.findOneAndUpdate({
    _id: submissionId,
    $expr: { $lt: ['$attempts', '$maxAttempts'] },
    $or: [
      { status: 'queued' },
      { status: 'failed', retryable: true },
      { status: 'processing', leaseExpiresAt: { $lte: now } },
    ],
  }, {
    $set: {
      status: 'processing',
      processingToken,
      leaseExpiresAt,
      startedAt: now,
      failedAt: null,
      lastErrorCode: '',
      lastErrorMessage: '',
    },
    $inc: { attempts: 1 },
  }, { new: true });

  if (claimed) return claimed;

  const current = await DeepReviewSubmission.findById(submissionId);
  if (!current) {
    throw createProcessingError(
      'Deep Review submission not found',
      'DEEP_REVIEW_SUBMISSION_NOT_FOUND',
      false,
    );
  }
  if (current.status === 'completed') return current;
  if (current.status === 'processing' && current.leaseExpiresAt > now) {
    throw createProcessingError(
      'Deep Review submission is already processing',
      'DEEP_REVIEW_ALREADY_PROCESSING',
      true,
    );
  }
  if (current.attempts >= current.maxAttempts || !current.retryable) return current;

  throw createProcessingError(
    'Deep Review submission could not be claimed',
    'DEEP_REVIEW_PROCESSING_FAILED',
    true,
  );
};

const findOrCreateFinalReview = async ({ submission, userBook, evaluation }) => {
  const existing = await DeepReview.findOne({ submissionId: submission._id });
  if (existing) return existing;

  const { result: aiResult, meta } = evaluation;
  const status = aiResult.state === 'APPROVED' ? 'approved' : 'guiding';
  const cognitiveDepth = status === 'approved' ? aiResult.cognitiveDepth : 0;
  const persistedAiResponse = { ...aiResult, meta };

  try {
    return await DeepReview.create({
      submissionId: submission._id,
      userId: submission.userId,
      userBookId: submission.userBookId,
      pageFrom: submission.pageFrom,
      pageTo: submission.pageTo,
      reviewText: submission.reviewText,
      cognitiveDepth,
      status,
      aiProvider: meta.provider,
      aiModel: meta.model,
      evaluationVersion: meta.evaluationVersion,
      wordCount: aiResult.wordCount,
      aiResponse: persistedAiResponse,
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const concurrent = await DeepReview.findOne({ submissionId: submission._id });
    if (!concurrent) throw error;
    return concurrent;
  }
};

const applyApprovedEffects = async ({ submission, userBook, review }) => {
  if (review.status !== 'approved') {
    if (!review.effectsAppliedAt) {
      review.effectsAppliedAt = new Date();
      await review.save();
    }
    return;
  }

  const persistedAiResponse = review.aiResponse || {};
  const embeddedReview = {
    submissionId: submission._id,
    reviewId: review._id,
    pageFrom: review.pageFrom,
    pageTo: review.pageTo,
    reviewText: review.reviewText,
    cognitiveDepth: review.cognitiveDepth,
    status: review.status,
    aiResponse: persistedAiResponse,
    createdAt: review.createdAt,
  };

  await UserBook.updateOne({
    _id: submission.userBookId,
    userId: submission.userId,
    'deepReviews.submissionId': { $ne: submission._id },
  }, {
    $max: { currentPage: review.pageTo },
    $set: { updatedAt: new Date() },
    $inc: { deepReviewCount: 1 },
    $push: { deepReviews: embeddedReview },
  });

  const pagesValidated = review.pageTo - review.pageFrom + 1;
  await SocialActivity.updateOne({
    sourceId: `deep-review:${submission._id}`,
  }, {
    $setOnInsert: {
      sourceId: `deep-review:${submission._id}`,
      userId: submission.userId,
      type: 'review_approved',
      bookId: userBook.bookId._id,
      pages: pagesValidated,
      cognitiveDepth: review.cognitiveDepth,
      message: `Validou ${pagesValidated} páginas de “${userBook.bookId.title}” com ${review.cognitiveDepth} de profundidade cognitiva.`,
      insight: persistedAiResponse.retentionPrompt || '',
      createdAt: review.createdAt,
    },
  }, { upsert: true });

  if (!review.effectsAppliedAt) {
    review.effectsAppliedAt = new Date();
    await review.save();
  }

  await achievementController.checkAndUnlockAchievements(submission.userId);
};

const markCompleted = async ({ submission, review }) => DeepReviewSubmission.findOneAndUpdate({
  _id: submission._id,
  processingToken: submission.processingToken,
}, {
  $set: {
    status: 'completed',
    resultReviewId: review._id,
    resultState: review.aiResponse?.state || (review.status === 'approved' ? 'APPROVED' : 'GUIDING'),
    completedAt: new Date(),
    failedAt: null,
    processingToken: '',
    leaseExpiresAt: null,
    retryable: false,
    lastErrorCode: '',
    lastErrorMessage: '',
  },
}, { new: true });

const markFailed = async ({ submissionId, processingToken, error }) => {
  const code = safeErrorCode(error);
  const retryable = error?.retryable ?? isRetryableError(error);
  const message = safeErrorMessage(error);

  await DeepReviewSubmission.updateOne({
    _id: submissionId,
    ...(processingToken ? { processingToken } : {}),
  }, {
    $set: {
      status: 'failed',
      failedAt: new Date(),
      processingToken: '',
      leaseExpiresAt: null,
      retryable,
      lastErrorCode: code,
      lastErrorMessage: message,
    },
  });

  error.code = code;
  error.retryable = retryable;
  error.safeMessage = message;
  return error;
};

const buildCompletedResult = async (submission) => {
  const review = submission.resultReviewId
    ? await DeepReview.findById(submission.resultReviewId)
    : await DeepReview.findOne({ submissionId: submission._id });
  if (!review) return { submission, review: null, aiResult: null };
  return {
    submission,
    review,
    aiResult: review.aiResponse || null,
  };
};

const processDeepReviewSubmission = async (submissionId, options = {}) => {
  let submission;
  try {
    submission = await claimSubmission(submissionId, options.leaseMs);
    if (submission.status === 'completed') return buildCompletedResult(submission);
    if (submission.status === 'failed' && !submission.retryable) {
      throw createProcessingError(
        submission.lastErrorMessage || 'Deep Review submission failed permanently',
        submission.lastErrorCode || 'DEEP_REVIEW_PROCESSING_FAILED',
        false,
      );
    }

    const userBook = await UserBook.findOne({
      _id: submission.userBookId,
      userId: submission.userId,
    }).populate('bookId');
    if (!userBook?.bookId) {
      throw createProcessingError(
        'Book no longer exists in the user library',
        'DEEP_REVIEW_BOOK_NOT_FOUND',
        false,
      );
    }

    let review = await DeepReview.findOne({ submissionId: submission._id });
    if (!review) {
      const totalPages = Number(userBook.totalPagesOverride)
        || Number(userBook.bookId.totalPages)
        || 0;
      const evaluation = await evaluateDeepReview({
        book: {
          ...userBook.bookId.toObject(),
          totalPages,
        },
        pageFrom: submission.pageFrom,
        pageTo: submission.pageTo,
        reviewText: submission.reviewText,
      });
      review = await findOrCreateFinalReview({ submission, userBook, evaluation });
    }

    await applyApprovedEffects({ submission, userBook, review });
    const completed = await markCompleted({ submission, review });
    if (!completed) {
      const current = await DeepReviewSubmission.findById(submission._id);
      if (current?.status === 'completed') return buildCompletedResult(current);
      throw createProcessingError(
        'Deep Review completion lease was lost',
        'DEEP_REVIEW_PROCESSING_FAILED',
        true,
      );
    }

    logger.info('deep_review_submission_completed', {
      submissionId: String(submission._id),
      userId: String(submission.userId),
      userBookId: String(submission.userBookId),
      attempts: completed.attempts,
      resultState: completed.resultState,
    });

    return {
      submission: completed,
      review,
      aiResult: review.aiResponse || null,
    };
  } catch (error) {
    const failed = await markFailed({
      submissionId,
      processingToken: submission?.processingToken,
      error,
    });
    logger.error('deep_review_submission_failed', {
      submissionId: String(submissionId),
      userId: submission?.userId ? String(submission.userId) : undefined,
      userBookId: submission?.userBookId ? String(submission.userBookId) : undefined,
      code: failed.code,
      retryable: failed.retryable,
      error: failed,
    });
    throw failed;
  }
};

module.exports = {
  DEFAULT_LEASE_MS,
  applyApprovedEffects,
  buildCompletedResult,
  claimSubmission,
  createProcessingError,
  isRetryableError,
  processDeepReviewSubmission,
  safeErrorCode,
  safeErrorMessage,
};
