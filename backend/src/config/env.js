require('dotenv').config();

const normalizeEnvironment = (env = process.env) => ({
  nodeEnv: env.NODE_ENV || 'development',
  port: Number(env.PORT) || 3001,
  mongoUri: env.MONGODB_URI || 'mongodb://localhost:27017/bubo',
  jwtSecret: env.JWT_SECRET || '',
  clientOrigins: String(env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: env.TRUST_PROXY === 'true',
  bodyLimit: env.BODY_LIMIT || '1mb',
  apiRateLimit: Math.max(10, Number(env.API_RATE_LIMIT) || 300),
  authRateLimit: Math.max(5, Number(env.AUTH_RATE_LIMIT) || 30),
});

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
  getEnvironment,
  normalizeEnvironment,
  validateEnvironment,
};
