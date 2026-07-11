const startedAt = new Date();
let acceptingTraffic = false;
let shuttingDown = false;

const markAcceptingTraffic = () => {
  acceptingTraffic = true;
  shuttingDown = false;
};

const markShuttingDown = () => {
  acceptingTraffic = false;
  shuttingDown = true;
};

const getRuntimeState = () => ({
  acceptingTraffic,
  shuttingDown,
  startedAt: startedAt.toISOString(),
  uptimeSeconds: Math.round(process.uptime()),
});

module.exports = {
  getRuntimeState,
  markAcceptingTraffic,
  markShuttingDown,
};
