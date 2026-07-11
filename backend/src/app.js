const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const { getEnvironment } = require('./config/env');
const observabilityMiddleware = require('./middleware/observability');
const { captureException } = require('./observability/errorReporter');
const { buildLiveness, buildReadiness } = require('./observability/health');
const { getMetricsSnapshot } = require('./observability/metrics');
const { getRuntimeState } = require('./observability/runtimeState');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const deepReviewRoutes = require('./routes/deepReview');
const socialRoutes = require('./routes/social');
const achievementRoutes = require('./routes/achievements');
const clubRoutes = require('./routes/clubs');

const config = getEnvironment(process.env, { allowInvalid: true });
const app = express();

if (config.trustProxy) app.set('trust proxy', 1);
app.set('etag', 'strong');
app.disable('x-powered-by');

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || config.clientOrigins.includes(origin)) return callback(null, true);
    const error = new Error('Origem não permitida pela política CORS.');
    error.status = 403;
    error.code = 'CORS_ORIGIN_DENIED';
    return callback(error);
  },
};

const createLimiter = ({ max, message }) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({
    message,
    code: 'RATE_LIMIT_EXCEEDED',
    requestId: req.requestId,
  }),
  skip: (req) => req.path.startsWith('/health'),
});

const apiLimiter = createLimiter({
  max: config.apiRateLimit,
  message: 'Muitas requisições. Aguarde alguns minutos e tente novamente.',
});

const authLimiter = createLimiter({
  max: config.authRateLimit,
  message: 'Muitas tentativas de autenticação. Aguarde e tente novamente.',
});

const bookSearchLimiter = createLimiter({
  max: config.bookSearchRateLimit,
  message: 'Muitas buscas em pouco tempo. Aguarde alguns minutos antes de consultar o catálogo novamente.',
});

const databaseReady = () => mongoose.connection.readyState === 1;

const readinessHandler = (req, res) => {
  const payload = buildReadiness({
    requestId: req.requestId,
    runtime: getRuntimeState(),
    databaseReady: databaseReady(),
  });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(payload.ready ? 200 : 503).json(payload);
};

const metricsAuthorized = (req, res, next) => {
  if (!config.metricsEnabled) {
    return res.status(404).json({
      message: 'Endpoint não encontrado.',
      code: 'ENDPOINT_NOT_FOUND',
      requestId: req.requestId,
    });
  }
  if (!config.metricsToken) return next();

  const provided = String(req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(config.metricsToken);
  const valid = providedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(providedBuffer, expectedBuffer);

  if (!valid) {
    return res.status(401).json({
      message: 'Credencial de métricas inválida.',
      code: 'METRICS_UNAUTHORIZED',
      requestId: req.requestId,
    });
  }
  return next();
};

app.use(observabilityMiddleware);
app.use(cors(corsOptions));
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));
app.use(mongoSanitize());

app.get('/api/health/live', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json(buildLiveness({
    requestId: req.requestId,
    runtime: getRuntimeState(),
  }));
});
app.get('/api/health/ready', readinessHandler);
app.get('/api/health', readinessHandler);

app.get('/api/metrics', metricsAuthorized, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.json(getMetricsSnapshot({
    database: databaseReady() ? 'connected' : 'disconnected',
    runtime: getRuntimeState(),
    service: config.serviceName,
    release: config.release,
  }));
});

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/books/search', bookSearchLimiter);
app.use('/api/books', bookRoutes);
app.use('/api/deep-review', deepReviewRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/clubs', clubRoutes);

app.use('/api', (req, res) => res.status(404).json({
  message: 'Endpoint não encontrado.',
  code: 'ENDPOINT_NOT_FOUND',
  requestId: req.requestId,
}));

app.use((err, req, res, next) => {
  const status = Number(err.status || err.statusCode) || 500;
  const path = req.originalUrl.split('?')[0];
  const code = /^[A-Z0-9_]{3,80}$/.test(String(err.code || ''))
    ? err.code
    : status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';

  logger.error('request_failed', {
    method: req.method,
    path,
    status,
    code,
    error: err,
  });

  if (status >= 500) {
    captureException(err, {
      method: req.method,
      path,
      status,
      code,
    });
  }

  if (res.headersSent) return next(err);
  return res.status(status).json({
    message: status >= 500 ? 'O Bubo encontrou uma falha inesperada.' : err.message,
    code,
    requestId: req.requestId,
    ...(config.nodeEnv === 'development' && status >= 500 ? { error: err.message } : {}),
  });
});

module.exports = app;
