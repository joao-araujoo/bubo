const mongoose = require('mongoose');
const { UnrecoverableError, Worker } = require('bullmq');
const { getEnvironment } = require('../config/env');
const { closeBullConnection, createBullConnection } = require('../infrastructure/queue/bullConnection');
const {
  captureException,
  configureErrorReporter,
  flushErrorReports,
} = require('../observability/errorReporter');
const {
  processDeepReviewSubmission,
} = require('../services/deepReview/deepReviewProcessor');
const logger = require('../utils/logger');

let worker = null;
let connectionResource = null;
let shuttingDown = false;

const shutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('deep_review_worker_shutdown_started', { signal });

  const forceExit = setTimeout(() => {
    logger.error('deep_review_worker_shutdown_timeout', { signal });
    process.exit(1);
  }, 15000);
  forceExit.unref();

  try {
    if (worker) await worker.close();
    await flushErrorReports(2500);
    await closeBullConnection(connectionResource);
    await mongoose.disconnect();
    logger.info('deep_review_worker_shutdown_completed', { signal });
    process.exit(exitCode);
  } catch (error) {
    logger.error('deep_review_worker_shutdown_failed', { signal, error });
    await captureException(error, { signal, phase: 'worker_shutdown' });
    process.exit(1);
  }
};

const start = async () => {
  const config = getEnvironment();
  configureErrorReporter(config);
  if (!config.deepReviewQueueEnabled) {
    const error = new Error('DEEP_REVIEW_QUEUE_ENABLED must be true for the worker process');
    error.code = 'DEEP_REVIEW_QUEUE_DISABLED';
    throw error;
  }

  mongoose.set('bufferCommands', false);
  await mongoose.connect(config.mongoUri, {
    maxPoolSize: Math.max(5, Math.min(config.mongoMaxPoolSize, config.deepReviewQueueConcurrency * 5)),
    minPoolSize: Math.min(config.mongoMinPoolSize, config.deepReviewQueueConcurrency),
    maxIdleTimeMS: config.mongoMaxIdleTimeMS,
    serverSelectionTimeoutMS: config.mongoServerSelectionTimeoutMS,
    socketTimeoutMS: config.mongoSocketTimeoutMS,
    retryReads: true,
    retryWrites: true,
  });

  connectionResource = await createBullConnection({
    redisUrl: config.redisUrl,
    connectTimeoutMs: config.redisConnectTimeoutMs,
    role: 'worker',
  });

  worker = new Worker(config.deepReviewQueueName, async (job) => {
    const submissionId = String(job.data?.submissionId || '');
    if (!/^[a-f\d]{24}$/i.test(submissionId)) {
      throw new UnrecoverableError('Deep Review job has an invalid submission ID');
    }

    try {
      const result = await processDeepReviewSubmission(submissionId, {
        leaseMs: config.deepReviewQueueLeaseMs,
      });
      return {
        submissionId,
        reviewId: result.review ? String(result.review._id) : null,
        state: result.aiResult?.state || result.submission?.resultState || null,
      };
    } catch (error) {
      if (error?.retryable === false) {
        throw new UnrecoverableError(error.safeMessage || error.message);
      }
      throw error;
    }
  }, {
    connection: connectionResource.connection,
    prefix: config.deepReviewQueuePrefix,
    concurrency: config.deepReviewQueueConcurrency,
    lockDuration: config.deepReviewQueueLeaseMs,
  });

  worker.on('ready', () => {
    logger.info('deep_review_worker_ready', {
      queue: config.deepReviewQueueName,
      prefix: config.deepReviewQueuePrefix,
      concurrency: config.deepReviewQueueConcurrency,
    });
  });
  worker.on('active', (job) => {
    logger.info('deep_review_job_started', {
      jobId: String(job.id),
      submissionId: String(job.data?.submissionId || ''),
      attempt: job.attemptsMade + 1,
    });
  });
  worker.on('completed', (job, result) => {
    logger.info('deep_review_job_completed', {
      jobId: String(job.id),
      submissionId: String(job.data?.submissionId || ''),
      result,
    });
  });
  worker.on('failed', (job, error) => {
    logger.error('deep_review_job_failed', {
      jobId: job?.id ? String(job.id) : undefined,
      submissionId: String(job?.data?.submissionId || ''),
      attemptsMade: job?.attemptsMade,
      error,
    });
  });
  worker.on('error', (error) => {
    logger.error('deep_review_worker_error', { error });
    captureException(error, { phase: 'worker_runtime' });
  });

  await worker.waitUntilReady();
  logger.info('deep_review_worker_started', {
    queue: config.deepReviewQueueName,
    concurrency: config.deepReviewQueueConcurrency,
    database: mongoose.connection.name,
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
  logger.error('deep_review_worker_unhandled_rejection', { error });
  captureException(error, { phase: 'worker_unhandledRejection' });
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  logger.error('deep_review_worker_uncaught_exception', { error });
  captureException(error, { phase: 'worker_uncaughtException' });
  shutdown('uncaughtException', 1);
});

start().catch(async (error) => {
  logger.error('deep_review_worker_startup_failed', { error });
  await captureException(error, { phase: 'worker_startup' });
  process.exit(1);
});
