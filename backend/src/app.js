const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const { getEnvironment } = require('./config/env');
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
app.disable('x-powered-by');

const corsOptions = {
  credentials: true,
  origin(origin, callback) {
    if (!origin || config.clientOrigins.includes(origin)) return callback(null, true);
    const error = new Error('Origin not allowed by CORS policy');
    error.status = 403;
    return callback(error);
  },
};

const createLimiter = ({ max, message }) => rateLimit({
  windowMs: 15 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message },
  skip: (req) => req.path === '/health',
});

const apiLimiter = createLimiter({
  max: config.apiRateLimit,
  message: 'Muitas requisições. Aguarde alguns minutos e tente novamente.',
});

const authLimiter = createLimiter({
  max: config.authRateLimit,
  message: 'Muitas tentativas de autenticação. Aguarde e tente novamente.',
});

app.use((req, res, next) => {
  const requestId = req.get('x-request-id') || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('cross-origin-resource-policy', 'same-site');

  const startedAt = Date.now();
  res.on('finish', () => {
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});

app.use(cors(corsOptions));
app.use(express.json({ limit: config.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));
app.use(mongoSanitize());

app.get('/api/health', (req, res) => {
  const databaseConnected = mongoose.connection.readyState === 1;
  const status = databaseConnected ? 'ok' : 'degraded';
  res.status(databaseConnected ? 200 : 503).json({
    status,
    database: databaseConnected ? 'connected' : 'disconnected',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/deep-review', deepReviewRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/clubs', clubRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({
    message: 'Endpoint não encontrado.',
    requestId: req.requestId,
  });
});

app.use((err, req, res, next) => {
  const status = Number(err.status || err.statusCode) || 500;
  logger.error('request_failed', {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl.split('?')[0],
    status,
    error: err,
  });

  if (res.headersSent) return next(err);
  return res.status(status).json({
    message: status >= 500 ? 'O Bubo encontrou uma falha inesperada.' : err.message,
    requestId: req.requestId,
    ...(config.nodeEnv === 'development' && status >= 500 ? { error: err.message } : {}),
  });
});

module.exports = app;
