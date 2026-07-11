const memoryMb = () => Math.round(process.memoryUsage().rss / 1024 / 1024);

const buildLiveness = ({ requestId, runtime }) => ({
  status: 'ok',
  service: 'bubo-api',
  uptimeSeconds: runtime?.uptimeSeconds ?? Math.round(process.uptime()),
  memoryMb: memoryMb(),
  runtime,
  timestamp: new Date().toISOString(),
  requestId,
});

const buildReadiness = ({ requestId, runtime, databaseReady, redis = {} }) => {
  const processReady = Boolean(runtime?.acceptingTraffic && !runtime?.shuttingDown);
  const redisEnabled = Boolean(redis.enabled);
  const redisReady = Boolean(redis.ready);
  const redisRequired = Boolean(redis.required);
  const ready = Boolean(databaseReady && processReady && (!redisRequired || redisReady));
  const database = databaseReady ? 'connected' : 'disconnected';
  const redisStatus = !redisEnabled ? 'disabled' : redisReady ? 'connected' : 'degraded';
  const fullyHealthy = ready && (!redisEnabled || redisReady);

  return {
    status: fullyHealthy ? 'ok' : 'degraded',
    ready,
    service: 'bubo-api',
    database,
    redis: redisStatus,
    uptimeSeconds: runtime?.uptimeSeconds ?? Math.round(process.uptime()),
    memoryMb: memoryMb(),
    checks: {
      process: processReady ? 'ready' : 'not-ready',
      database,
      redis: redisStatus,
    },
    dependencies: {
      redis: {
        enabled: redisEnabled,
        required: redisRequired,
        ready: redisReady,
        status: redis.status || redisStatus,
      },
    },
    runtime,
    timestamp: new Date().toISOString(),
    requestId,
  };
};

module.exports = {
  buildLiveness,
  buildReadiness,
};
