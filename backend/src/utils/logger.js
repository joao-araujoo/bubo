const { getRequestContext } = require('../observability/requestContext');

const SENSITIVE_KEY = /(pass(word)?|token|secret|authorization|cookie|api[-_]?key|credential|session|jwt)/i;
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 4000;

const serializeError = (error) => {
  if (!error) return undefined;
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
  };
};

const sanitizeValue = (value, key = '', depth = 0, seen = new WeakSet()) => {
  if (SENSITIVE_KEY.test(key)) return '[REDACTED]';
  if (value === null || value === undefined) return value;
  if (value instanceof Error) return sanitizeValue(serializeError(value), key, depth + 1, seen);
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]` : value;
  }
  if (typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, key, depth + 1, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      sanitizeValue(entryValue, entryKey, depth + 1, seen),
    ]),
  );
};

const write = (level, message, context = {}) => {
  const requestContext = getRequestContext();
  const payload = sanitizeValue({
    timestamp: new Date().toISOString(),
    level,
    message,
    requestId: context.requestId || requestContext.requestId,
    userId: context.userId || requestContext.userId,
    ...context,
  });

  const output = JSON.stringify(payload);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
};

module.exports = {
  info: (message, context) => write('info', message, context),
  warn: (message, context) => write('warn', message, context),
  error: (message, context) => write('error', message, context),
  sanitizeValue,
  serializeError,
};
