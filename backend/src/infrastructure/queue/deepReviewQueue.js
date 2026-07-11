const { Queue } = require('bullmq');
const logger = require('../../utils/logger');
const { closeBullConnection, createBullConnection } = require('./bullConnection');

let config = {
  deepReviewQueueEnabled: false,
  deepReviewQueueName: 'deep-review',
  deepReviewQueuePrefix: 'bubo:development:bullmq',
  deepReviewQueueAttempts: 3,
  deepReviewQueueBackoffMs: 5000,
  deepReviewQueueCompletedRetention: 1000,
  deepReviewQueueFailedRetention: 5000,
  redisUrl: '',
  redisConnectTimeoutMs: 5000,
};
let queue = null;
let connectionResource = null;
const state = {
  status: 'disabled',
  enabled: false,
  ready: false,
  enqueued: 0,
  enqueueFailures: 0,
  lastErrorAt: null,
  lastReadyAt: null,
};

const configureDeepReviewQueue = (nextConfig = {}) => {
  config = { ...config, ...nextConfig };
  state.enabled = Boolean(config.deepReviewQueueEnabled);
  state.status = state.enabled ? 'configured' : 'disabled';
  return getDeepReviewQueueState();
};

const getDeepReviewQueueState = () => ({
  ...state,
  name: config.deepReviewQueueName,
  prefix: config.deepReviewQueuePrefix,
  attempts: config.deepReviewQueueAttempts,
});

const connectDeepReviewQueue = async () => {
  if (!config.deepReviewQueueEnabled) {
    state.enabled = false;
    state.ready = false;
    state.status = 'disabled';
    return getDeepReviewQueueState();
  }
  if (queue && state.ready) return getDeepReviewQueueState();

  state.enabled = true;
  state.status = 'connecting';
  try {
    connectionResource = await createBullConnection({
      redisUrl: config.redisUrl,
      connectTimeoutMs: config.redisConnectTimeoutMs,
      role: 'producer',
    });
    queue = new Queue(config.deepReviewQueueName, {
      connection: connectionResource.connection,
      prefix: config.deepReviewQueuePrefix,
      defaultJobOptions: {
        attempts: config.deepReviewQueueAttempts,
        backoff: {
          type: 'exponential',
          delay: config.deepReviewQueueBackoffMs,
        },
        removeOnComplete: { count: config.deepReviewQueueCompletedRetention },
        removeOnFail: { count: config.deepReviewQueueFailedRetention },
      },
    });
    queue.on('error', (error) => {
      state.ready = false;
      state.status = 'degraded';
      state.enqueueFailures += 1;
      state.lastErrorAt = new Date().toISOString();
      logger.error('deep_review_queue_error', { error });
    });
    await queue.waitUntilReady();
    state.ready = true;
    state.status = 'ready';
    state.lastReadyAt = new Date().toISOString();
    logger.info('deep_review_queue_ready', {
      name: config.deepReviewQueueName,
      prefix: config.deepReviewQueuePrefix,
    });
    return getDeepReviewQueueState();
  } catch (error) {
    state.ready = false;
    state.status = 'degraded';
    state.enqueueFailures += 1;
    state.lastErrorAt = new Date().toISOString();
    await closeDeepReviewQueue();
    throw error;
  }
};

const enqueueDeepReviewSubmission = async (submission, { retry = false } = {}) => {
  if (!config.deepReviewQueueEnabled) {
    const error = new Error('Deep Review queue is disabled');
    error.code = 'DEEP_REVIEW_QUEUE_DISABLED';
    throw error;
  }
  if (!queue || !state.ready) {
    const error = new Error('Deep Review queue is unavailable');
    error.code = 'DEEP_REVIEW_QUEUE_UNAVAILABLE';
    throw error;
  }

  const jobId = String(submission._id);
  try {
    const existing = await queue.getJob(jobId);
    if (existing) {
      const jobState = await existing.getState();
      if (retry && jobState === 'failed') {
        await existing.retry();
        logger.info('deep_review_job_retried', { submissionId: jobId, jobId });
      }
      return existing;
    }

    const job = await queue.add('evaluate', { submissionId: jobId }, {
      jobId,
      attempts: submission.maxAttempts || config.deepReviewQueueAttempts,
    });
    state.enqueued += 1;
    logger.info('deep_review_job_enqueued', {
      submissionId: jobId,
      jobId: String(job.id),
      maxAttempts: submission.maxAttempts || config.deepReviewQueueAttempts,
    });
    return job;
  } catch (error) {
    state.enqueueFailures += 1;
    state.lastErrorAt = new Date().toISOString();
    logger.error('deep_review_job_enqueue_failed', {
      submissionId: jobId,
      error,
    });
    throw error;
  }
};

const closeDeepReviewQueue = async () => {
  state.ready = false;
  state.status = state.enabled ? 'stopped' : 'disabled';
  if (queue) {
    try {
      await queue.close();
    } catch (error) {
      logger.warn('deep_review_queue_close_failed', { error });
    }
  }
  queue = null;
  await closeBullConnection(connectionResource);
  connectionResource = null;
};

module.exports = {
  closeDeepReviewQueue,
  configureDeepReviewQueue,
  connectDeepReviewQueue,
  enqueueDeepReviewSubmission,
  getDeepReviewQueueState,
};
