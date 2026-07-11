require('dotenv').config();

const numberWithin = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

const booleanValue = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const normalizeEnvironment = (env = process.env) => {
  const nodeEnv = env.NODE_ENV || 'development';

  return {
    nodeEnv,
    port: Number(env.PORT) || 3001,
    serviceName: env.SERVICE_NAME || 'bubo-api',
    release: env.APP_RELEASE || env.GITHUB_SHA || 'development',
    mongoUri: env.MONGODB_URI || 'mongodb://localhost:27017/bubo',
    mongoMaxPoolSize: numberWithin(env.MONGO_MAX_POOL_SIZE, 50, 5, 500),
    mongoMinPoolSize: numberWithin(env.MONGO_MIN_POOL_SIZE, 5, 0, 100),
    mongoMaxIdleTimeMS: numberWithin(env.MONGO_MAX_IDLE_TIME_MS, 60000, 1000, 600000),
    mongoServerSelectionTimeoutMS: numberWithin(env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 10000, 1000, 60000),
    mongoSocketTimeoutMS: numberWithin(env.MONGO_SOCKET_TIMEOUT_MS, 45000, 5000, 300000),
    jwtSecret: env.JWT_SECRET || '',
    clientOrigins: String(env.CLIENT_URL || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy: booleanValue(env.TRUST_PROXY),
    bodyLimit: env.BODY_LIMIT || '1mb',
    apiRateLimit: Math.max(10, Number(env.API_RATE_LIMIT) || 300),
    authRateLimit: Math.max(5, Number(env.AUTH_RATE_LIMIT) || 30),
    bookSearchRateLimit: Math.max(10, Number(env.BOOK_SEARCH_RATE_LIMIT) || 60),
    metricsEnabled: booleanValue(env.METRICS_ENABLED, nodeEnv !== 'production'),
    metricsToken: env.METRICS_TOKEN || '',
    errorReportingUrl: env.ERROR_REPORTING_URL || '',
    errorReportingToken: env.ERROR_REPORTING_TOKEN || '',
    errorReportingTimeoutMs: numberWithin(env.ERROR_REPORTING_TIMEOUT_MS, 3000, 500, 15000),
  };
};

const isValidHttpUrl = (value) => {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
};

const validateEnvironment = (config) => {
  const errors = [];

  if (!config.mongoUri) errors.push('MONGODB_URI is required');
  if (!config.jwtSecret || config.jwtSecret.length < 24) {
    errors.push('JWT_SECRET must contain at least 24 characters');
  }
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    errors.push('PORT must be a valid TCP port');
  }
  if (config.clientOrigins.length === 0) {
    errors.push('CLIENT_URL must contain at least one allowed origin');
  }
  if (config.mongoMinPoolSize > config.mongoMaxPoolSize) {
    errors.push('MONGO_MIN_POOL_SIZE cannot be greater than MONGO_MAX_POOL_SIZE');
  }
  if (config.nodeEnv === 'production' && config.metricsEnabled && config.metricsToken.length < 24) {
    errors.push('METRICS_TOKEN must contain at least 24 characters when metrics are enabled in production');
  }
  if (config.errorReportingUrl && !isValidHttpUrl(config.errorReportingUrl)) {
    errors.push('ERROR_REPORTING_URL must be a valid HTTP or HTTPS URL without embedded credentials');
  }
  if (config.nodeEnv === 'production' && config.errorReportingUrl && config.errorReportingToken.length < 16) {
    errors.push('ERROR_REPORTING_TOKEN must contain at least 16 characters in production');
  }

  return errors;
};

const getEnvironment = (env = process.env, options = {}) => {
  const config = normalizeEnvironment(env);
  const errors = validateEnvironment(config);

  if (errors.length > 0 && !options.allowInvalid) {
    const error = new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
    error.code = 'INVALID_ENVIRONMENT';
    error.details = errors;
    throw error;
  }

  return { ...config, errors };
};

module.exports = {
  booleanValue,
  getEnvironment,
  normalizeEnvironment,
  validateEnvironment,
};
