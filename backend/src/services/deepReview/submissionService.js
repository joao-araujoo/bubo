const crypto = require('crypto');
const DeepReviewSubmission = require('../../models/DeepReviewSubmission');
const UserBook = require('../../models/UserBook');
const { MIN_REVIEW_WORDS } = require('../ai/readingCoach');

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/;

const countWords = (text) => String(text || '').trim().split(/\s+/).filter(Boolean).length;

const fingerprintFor = ({ userId, userBookId, pageFrom, pageTo, reviewText }) => crypto
  .createHash('sha256')
  .update(JSON.stringify({
    userId: String(userId),
    userBookId: String(userBookId),
    pageFrom: Number(pageFrom),
    pageTo: Number(pageTo),
    reviewText: String(reviewText || '').trim(),
  }))
  .digest('hex');

const normalizeIdempotencyKey = (candidate, fingerprint) => {
  const normalized = String(candidate || '').trim();
  if (!normalized) return `auto:${fingerprint}`;
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    const error = new Error('A chave de idempotência é inválida.');
    error.code = 'INVALID_IDEMPOTENCY_KEY';
    error.status = 400;
    throw error;
  }
  return normalized;
};

const validateSubmissionInput = async ({ userId, userBookId, pageFrom, pageTo, reviewText }) => {
  const userBook = await UserBook.findOne({ _id: userBookId, userId }).populate('bookId');
  if (!userBook) {
    const error = new Error('Livro não encontrado no seu acervo.');
    error.code = 'USER_BOOK_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  const from = Number(pageFrom);
  const to = Number(pageTo);
  const text = String(reviewText || '').trim();
  const totalPages = Number(userBook.totalPagesOverride)
    || Number(userBook.bookId?.totalPages)
    || 0;

  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    const error = new Error('Intervalo de páginas inválido.');
    error.code = 'INVALID_PAGE_RANGE';
    error.status = 400;
    throw error;
  }
  if (from <= Number(userBook.currentPage || 0)) {
    const error = new Error(`A página inicial deve ser maior que ${userBook.currentPage || 0}.`);
    error.code = 'PAGE_RANGE_ALREADY_VALIDATED';
    error.status = 409;
    throw error;
  }
  if (totalPages > 0 && to > totalPages) {
    const error = new Error(`A página final não pode ultrapassar ${totalPages}.`);
    error.code = 'PAGE_RANGE_EXCEEDS_BOOK';
    error.status = 400;
    throw error;
  }
  if (!text || countWords(text) < MIN_REVIEW_WORDS) {
    const error = new Error(`Escreva pelo menos ${MIN_REVIEW_WORDS} palavras para receber uma avaliação confiável.`);
    error.code = 'REVIEW_TOO_SHORT';
    error.status = 400;
    throw error;
  }

  return {
    userBook,
    pageFrom: from,
    pageTo: to,
    reviewText: text,
  };
};

const createOrGetSubmission = async ({
  userId,
  userBookId,
  pageFrom,
  pageTo,
  reviewText,
  idempotencyKey,
  executionMode,
  maxAttempts,
}) => {
  const validated = await validateSubmissionInput({
    userId,
    userBookId,
    pageFrom,
    pageTo,
    reviewText,
  });
  const fingerprint = fingerprintFor({
    userId,
    userBookId,
    pageFrom: validated.pageFrom,
    pageTo: validated.pageTo,
    reviewText: validated.reviewText,
  });
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey, fingerprint);

  try {
    const submission = await DeepReviewSubmission.create({
      userId,
      userBookId,
      idempotencyKey: normalizedKey,
      fingerprint,
      pageFrom: validated.pageFrom,
      pageTo: validated.pageTo,
      reviewText: validated.reviewText,
      status: 'queued',
      executionMode,
      maxAttempts,
      queuedAt: new Date(),
    });
    return { submission, created: true, userBook: validated.userBook };
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const existing = await DeepReviewSubmission.findOne({ userId, idempotencyKey: normalizedKey });
    if (!existing) throw error;
    if (existing.fingerprint !== fingerprint) {
      const conflict = new Error('Esta chave de idempotência já foi usada com outro conteúdo.');
      conflict.code = 'IDEMPOTENCY_KEY_REUSED';
      conflict.status = 409;
      throw conflict;
    }
    return { submission: existing, created: false, userBook: validated.userBook };
  }
};

const getOwnedSubmission = async ({ submissionId, userId }) => {
  const submission = await DeepReviewSubmission.findOne({ _id: submissionId, userId });
  if (!submission) {
    const error = new Error('Submissão de Deep Review não encontrada.');
    error.code = 'DEEP_REVIEW_SUBMISSION_NOT_FOUND';
    error.status = 404;
    throw error;
  }
  return submission;
};

const prepareSubmissionRetry = async ({ submissionId, userId }) => {
  const submission = await getOwnedSubmission({ submissionId, userId });
  if (submission.status === 'completed') return submission;
  if (submission.status === 'processing') {
    const error = new Error('Esta Deep Review já está sendo processada.');
    error.code = 'DEEP_REVIEW_ALREADY_PROCESSING';
    error.status = 409;
    throw error;
  }
  if (!submission.retryable) {
    const error = new Error(submission.lastErrorMessage || 'Esta falha não pode ser repetida automaticamente.');
    error.code = submission.lastErrorCode || 'DEEP_REVIEW_NOT_RETRYABLE';
    error.status = 409;
    throw error;
  }
  if (submission.attempts >= submission.maxAttempts) {
    const error = new Error('O limite de tentativas desta Deep Review foi atingido.');
    error.code = 'DEEP_REVIEW_ATTEMPTS_EXHAUSTED';
    error.status = 409;
    throw error;
  }

  submission.status = 'queued';
  submission.queuedAt = new Date();
  submission.failedAt = null;
  submission.processingToken = '';
  submission.leaseExpiresAt = null;
  submission.lastErrorCode = '';
  submission.lastErrorMessage = '';
  await submission.save();
  return submission;
};

const serializeSubmission = (submission) => ({
  id: String(submission._id),
  userBookId: String(submission.userBookId),
  status: submission.status,
  executionMode: submission.executionMode,
  attempts: submission.attempts,
  maxAttempts: submission.maxAttempts,
  retryable: submission.retryable,
  resultReviewId: submission.resultReviewId ? String(submission.resultReviewId) : null,
  resultState: submission.resultState,
  error: submission.status === 'failed'
    ? {
      code: submission.lastErrorCode || 'DEEP_REVIEW_PROCESSING_FAILED',
      message: submission.lastErrorMessage || 'Não foi possível processar a Deep Review agora.',
      retryable: submission.retryable,
    }
    : null,
  queuedAt: submission.queuedAt,
  startedAt: submission.startedAt,
  completedAt: submission.completedAt,
  failedAt: submission.failedAt,
  createdAt: submission.createdAt,
  updatedAt: submission.updatedAt,
});

module.exports = {
  IDEMPOTENCY_KEY_PATTERN,
  countWords,
  createOrGetSubmission,
  fingerprintFor,
  getOwnedSubmission,
  normalizeIdempotencyKey,
  prepareSubmissionRetry,
  serializeSubmission,
  validateSubmissionInput,
};
