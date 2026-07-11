const logger = require('../utils/logger');
const { beginHttpRequest } = require('../observability/metrics');
const {
  createRequestId,
  getRequestContext,
  runWithRequestContext,
} = require('../observability/requestContext');

const applySecurityHeaders = (res) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('cross-origin-resource-policy', 'same-site');
};

const observabilityMiddleware = (req, res, next) => {
  const requestId = createRequestId(req.get('x-request-id'));
  const startedAt = Date.now();
  const completeMetric = beginHttpRequest();
  let finished = false;

  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  applySecurityHeaders(res);

  const finalize = ({ aborted = false } = {}) => {
    if (finished) return;
    finished = true;
    const durationMs = Date.now() - startedAt;
    const path = req.originalUrl.split('?')[0];
    const context = getRequestContext();

    completeMetric({
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs,
      aborted,
    });

    logger.info(aborted ? 'http_request_aborted' : 'http_request', {
      method: req.method,
      path,
      status: res.statusCode,
      durationMs,
      responseBytes: Number(res.getHeader('content-length')) || undefined,
      userId: context.userId,
    });
  };

  res.once('finish', () => finalize());
  res.once('close', () => {
    if (!res.writableEnded) finalize({ aborted: true });
  });

  runWithRequestContext({
    requestId,
    method: req.method,
    path: req.originalUrl.split('?')[0],
    startedAt,
  }, next);
};

module.exports = observabilityMiddleware;
