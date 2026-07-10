const mongoose = require('mongoose');
const app = require('./app');
const { getEnvironment } = require('./config/env');
const logger = require('./utils/logger');

let httpServer;
let shuttingDown = false;

const shutdown = async (signal, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutdown_started', { signal });

  const forceExit = setTimeout(() => {
    logger.error('shutdown_timeout', { signal });
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (httpServer) {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
    await mongoose.disconnect();
    logger.info('shutdown_completed', { signal });
    process.exit(exitCode);
  } catch (error) {
    logger.error('shutdown_failed', { signal, error });
    process.exit(1);
  }
};

const start = async () => {
  const config = getEnvironment();

  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
  logger.info('database_connected', {
    host: mongoose.connection.host,
    database: mongoose.connection.name,
  });

  httpServer = app.listen(config.port, () => {
    logger.info('server_started', {
      port: config.port,
      environment: config.nodeEnv,
      allowedOrigins: config.clientOrigins,
    });
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (error) => {
  logger.error('unhandled_rejection', { error });
  shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', { error });
  shutdown('uncaughtException', 1);
});

start().catch((error) => {
  logger.error('startup_failed', { error });
  process.exit(1);
});
