const logger = require('../utils/logger');
const { getRequestContext } = require('./requestContext');

let configuration = {
  enabled: false,
  url: '',
  token: '',
  timeoutMs: 3000,
  environment: 'development',
  release: 'development',
  service: 'bubo-api',
};
const pendingReports = new Set();

const configureErrorReporter = (config = {}) => {
  configuration = {
    enabled: Boolean(config.errorReportingUrl),
    url: config.errorReportingUrl || '',
    token: config.errorReportingToken || '',
    timeoutMs: config.errorReportingTimeoutMs || 3000,
    environment: config.nodeEnv || 'development',
    release: config.release || 'development',
    service: config.serviceName || 'bubo-api',
  };

  logger.info('error_reporter_configured', {
    enabled: configuration.enabled,
    environment: configuration.environment,
    release: configuration.release,
  });
};

const buildPayload = (error, context = {}) => ({
  timestamp: new Date().toISOString(),
  service: configuration.service,
  environment: configuration.environment,
  release: configuration.release,
  request: getRequestContext(),
  context,
  error: {
    name: error?.name || 'Error',
    message: error?.message || String(error || 'Unknown error'),
    code: error?.code,
    stack: error?.stack,
  },
});

const captureException = (error, context = {}) => {
  if (!configuration.enabled || !configuration.url) return Promise.resolve(false);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs);
  timeout.unref?.();

  const report = fetch(configuration.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(configuration.token ? { authorization: `Bearer ${configuration.token}` } : {}),
    },
    body: JSON.stringify(buildPayload(error, context)),
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Error collector returned ${response.status}`);
      return true;
    })
    .catch((reportingError) => {
      logger.warn('error_report_failed', {
        collectorHost: (() => {
          try {
            return new URL(configuration.url).host;
          } catch {
            return 'invalid-url';
          }
        })(),
        error: reportingError,
      });
      return false;
    })
    .finally(() => {
      clearTimeout(timeout);
      pendingReports.delete(report);
    });

  pendingReports.add(report);
  return report;
};

const flushErrorReports = async (timeoutMs = 3000) => {
  if (pendingReports.size === 0) return;
  await Promise.race([
    Promise.allSettled([...pendingReports]),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
};

module.exports = {
  captureException,
  configureErrorReporter,
  flushErrorReports,
};
