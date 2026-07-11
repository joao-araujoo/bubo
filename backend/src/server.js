const mongoose = require('mongoose');
const app = require('./app');
const { getEnvironment } = require('./config/env');
const {
  connectRedis,
  disconnectRedis,
  getRedisState,
} = require('./infrastructure/redis/redisManager');
const {
  captureException,
  configureErrorReporter,
  flushErrorReports,
} = require('./observability/errorReporter');
const { stopMetrics } = require('./observability/metrics');
const {
  markAcceptingTraffic,
  markShuttingDown,
} = require('./observability/runtimeState');
const logger = require('./utils/logger');

let httpServer;
let shuttingDown = false;

const shutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  markShuttingDown();
  logger.info('shutdown_started', { signal });

  const forceExit = setTimeout(() => {
    logger.error('shutdown_timeout', { signal });
    httpServer?.closeAllConnections?.();
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await flushErrorReports(2500);
    await disconnectRedis();
    await mongoose.disconnect();
    stopMetrics();
    logger.info('shutdown_completed', { signal });
    process.exit(exitCode);
  } catch (error) {
    logger.error('shutdown_failed', { signal, error });
    await captureException(error, { signal, phase: 'shutdown' });
    process.exit(1);
  }
};

const start = async () => {
  const config = getEnvironment();
  configureErrorReporter(config);

  mongoose.set('bufferCommands', false);
  await mongoose.connect(config.mongoUri, {
    maxPoolSize: config.mongoMaxPoolSize,
    minPoolSize: config.mongoMinPoolSize,
    maxIdleTimeMS: config.mongoMaxIdleTimeMS,
    serverSelectionTimeoutMS: config.mongoServerSelectionTimeoutMS,
    socketTimeoutMS: config.mongoSocketTimeoutMS,
    retryReads: true,
    retryWrites: true,
  });
  logger.info('database_connected', {
    host: mongoose.connection.host,
    database: mongoose.connection.name,
    maxPoolSize: config.mongoMaxPoolSize,
    minPoolSize: config.mongoMinPoolSize,
  });

  const redisState = await connectRedis();
  logger.info('redis_startup_state', redisState);

  httpServer = app.listen(config.port, () => {
    markAcceptingTraffic();
    logger.info('server_started', {
      port: config.port,
      environment: config.nodeEnv,
      service: config.serviceName,
      release: config.release,
      instanceCount: config.instanceCount,
      redis: getRedisState(),
      metricsEnabled: config.metricsEnabled,
      errorReportingEnabled: Boolean(config.errorReportingUrl),
      allowedOrigins: config.clientOrigins,
    });
  });

  httpServer.keepAliveTimeout = 65000;
  httpServer.headersTimeout = 70000;
  httpServer.requestTimeout = 65000;
  httpServer.maxRequestsPerSocket = 1000;
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
  logger.error('unhandled_rejection', { error });
  captureException(error, { phase: 'unhandledRejection' });
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', { error });
  captureException(error, { phase: 'uncaughtException' });
  shutdown('uncaughtException', 1);
});

start().catch(async (error) => {
  logger.error('startup_failed', { error });
  await captureException(error, { phase: 'startup', redis: getRedisState() });
  process.exit(1);
});
