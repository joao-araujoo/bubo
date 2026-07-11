const buildLiveness = ({ requestId, runtime }) => ({
  status: 'ok',
  service: 'bubo-api',
  runtime,
  timestamp: new Date().toISOString(),
  requestId,
});

const buildReadiness = ({ requestId, runtime, databaseReady }) => {
  const ready = Boolean(databaseReady && runtime?.acceptingTraffic && !runtime?.shuttingDown);

  return {
    status: ready ? 'ok' : 'degraded',
    ready,
    service: 'bubo-api',
    checks: {
      process: runtime?.acceptingTraffic && !runtime?.shuttingDown ? 'ready' : 'not-ready',
      database: databaseReady ? 'connected' : 'disconnected',
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
