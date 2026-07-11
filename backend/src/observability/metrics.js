const { monitorEventLoopDelay } = require('perf_hooks');

const LATENCY_BUCKETS_MS = [50, 100, 250, 500, 1000, 2500, 5000];
const eventLoopHistogram = monitorEventLoopDelay({ resolution: 20 });
eventLoopHistogram.enable();

const createInitialState = () => ({
  startedAt: new Date(),
  activeRequests: 0,
  totalRequests: 0,
  totalErrors: 0,
  abortedRequests: 0,
  durationMsTotal: 0,
  durationMsMax: 0,
  latencyBuckets: Object.fromEntries(LATENCY_BUCKETS_MS.map((bucket) => [bucket, 0])),
  statusClasses: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  routes: new Map(),
});

let state = createInitialState();

const normalizePath = (value = '/') => {
  const pathname = String(value).split('?')[0] || '/';
  return pathname
    .replace(/\/[a-f\d]{24}(?=\/|$)/gi, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,36}(?=\/|$)/gi, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
};

const statusClass = (statusCode) => `${Math.floor(Number(statusCode || 500) / 100)}xx`;

const beginHttpRequest = () => {
  state.activeRequests += 1;
  let completed = false;

  return ({ method, path, statusCode, durationMs, aborted = false }) => {
    if (completed) return;
    completed = true;
    state.activeRequests = Math.max(0, state.activeRequests - 1);
    state.totalRequests += 1;
    if (aborted) state.abortedRequests += 1;

    const normalizedDuration = Math.max(0, Number(durationMs) || 0);
    state.durationMsTotal += normalizedDuration;
    state.durationMsMax = Math.max(state.durationMsMax, normalizedDuration);

    for (const bucket of LATENCY_BUCKETS_MS) {
      if (normalizedDuration <= bucket) state.latencyBuckets[bucket] += 1;
    }

    const category = statusClass(statusCode);
    state.statusClasses[category] = (state.statusClasses[category] || 0) + 1;
    if (Number(statusCode) >= 500) state.totalErrors += 1;

    const key = `${String(method || 'UNKNOWN').toUpperCase()} ${normalizePath(path)}`;
    const route = state.routes.get(key) || { count: 0, errors: 0, durationMsTotal: 0, durationMsMax: 0 };
    route.count += 1;
    route.durationMsTotal += normalizedDuration;
    route.durationMsMax = Math.max(route.durationMsMax, normalizedDuration);
    if (Number(statusCode) >= 500) route.errors += 1;
    state.routes.set(key, route);
  };
};

const recordApplicationError = () => {
  state.totalErrors += 1;
};

const toMilliseconds = (nanoseconds) => {
  const numeric = Number(nanoseconds);
  return Number.isFinite(numeric) ? Math.round((numeric / 1e6) * 100) / 100 : 0;
};

const getMetricsSnapshot = ({
  database,
  redis,
  runtime,
  service = 'bubo-api',
  release = 'development',
} = {}) => {
  const memory = process.memoryUsage();
  const routes = Object.fromEntries(
    [...state.routes.entries()].map(([key, value]) => [key, {
      ...value,
      durationMsAverage: value.count > 0 ? Math.round((value.durationMsTotal / value.count) * 100) / 100 : 0,
    }]),
  );

  return {
    service,
    release,
    collectedAt: new Date().toISOString(),
    windowStartedAt: state.startedAt.toISOString(),
    runtime,
    database,
    redis,
    http: {
      activeRequests: state.activeRequests,
      totalRequests: state.totalRequests,
      totalErrors: state.totalErrors,
      abortedRequests: state.abortedRequests,
      durationMsAverage: state.totalRequests > 0
        ? Math.round((state.durationMsTotal / state.totalRequests) * 100) / 100
        : 0,
      durationMsMax: state.durationMsMax,
      latencyBuckets: { ...state.latencyBuckets },
      statusClasses: { ...state.statusClasses },
      routes,
    },
    process: {
      pid: process.pid,
      nodeVersion: process.version,
      memoryMb: {
        rss: Math.round(memory.rss / 1024 / 1024),
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
        external: Math.round(memory.external / 1024 / 1024),
      },
      eventLoopDelayMs: {
        mean: toMilliseconds(eventLoopHistogram.mean),
        p95: toMilliseconds(eventLoopHistogram.percentile(95)),
        p99: toMilliseconds(eventLoopHistogram.percentile(99)),
        max: toMilliseconds(eventLoopHistogram.max),
      },
    },
  };
};

const resetMetrics = () => {
  state = createInitialState();
  eventLoopHistogram.reset();
};

const stopMetrics = () => eventLoopHistogram.disable();

module.exports = {
  beginHttpRequest,
  getMetricsSnapshot,
  normalizePath,
  recordApplicationError,
  resetMetrics,
  stopMetrics,
};
