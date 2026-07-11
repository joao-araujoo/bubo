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

const buildReadiness = ({ requestId, runtime, databaseReady }) => {
  const ready = Boolean(databaseReady && runtime?.acceptingTraffic && !runtime?.shuttingDown);
  const database = databaseReady ? 'connected' : 'disconnected';

  return {
    status: ready ? 'ok' : 'degraded',
    ready,
    service: 'bubo-api',
    database,
    uptimeSeconds: runtime?.uptimeSeconds ?? Math.round(process.uptime()),
    memoryMb: memoryMb(),
    checks: {
      process: runtime?.acceptingTraffic && !runtime?.shuttingDown ? 'ready' : 'not-ready',
      database,
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
