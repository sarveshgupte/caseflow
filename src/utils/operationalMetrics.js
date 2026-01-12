const metrics = {
  requests: {},
  lastError: {},
  lastInvariant: {},
  lastRateLimit: {},
};

const firmKey = (firmId) => firmId || 'none';

const recordRequest = (req) => {
  const key = firmKey(req?.firmId);
  metrics.requests[key] = (metrics.requests[key] || 0) + 1;
};

const recordError = (req, error) => {
  const key = firmKey(req?.firmId);
  metrics.lastError[key] = {
    at: new Date().toISOString(),
    route: req?.originalUrl || req?.url || null,
    requestId: req?.requestId || null,
    message: error?.message || String(error),
  };
};

const recordInvariantViolation = (req, reason) => {
  const key = firmKey(req?.firmId);
  metrics.lastInvariant[key] = {
    at: new Date().toISOString(),
    route: req?.originalUrl || req?.url || null,
    requestId: req?.requestId || null,
    reason,
  };
};

const recordRateLimitHit = (req, endpoint) => {
  const key = firmKey(req?.firmId);
  metrics.lastRateLimit[key] = {
    at: new Date().toISOString(),
    route: endpoint || req?.originalUrl || req?.url || null,
    requestId: req?.requestId || null,
  };
};

const getDashboardSnapshot = () => {
  const allFirmKeys = new Set([
    ...Object.keys(metrics.requests),
    ...Object.keys(metrics.lastError),
    ...Object.keys(metrics.lastInvariant),
    ...Object.keys(metrics.lastRateLimit),
  ]);

  return Array.from(allFirmKeys).map((key) => ({
    firmId: key === 'none' ? null : key,
    totalRequests: metrics.requests[key] || 0,
    lastError: metrics.lastError[key] || null,
    lastInvariantViolation: metrics.lastInvariant[key] || null,
    lastRateLimit: metrics.lastRateLimit[key] || null,
  }));
};

module.exports = {
  recordRequest,
  recordError,
  recordInvariantViolation,
  recordRateLimitHit,
  getDashboardSnapshot,
};
