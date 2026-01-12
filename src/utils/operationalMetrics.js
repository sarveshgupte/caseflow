const metrics = {
  requests: {},
  lastError: {},
  lastInvariant: {},
  lastRateLimit: {},
};

const NO_FIRM_ID = 'NO_FIRM_ID';
const firmKey = (firmId) => firmId || NO_FIRM_ID;
const MAX_FIRM_TRACKING = 500;
const firmOrder = [];
const firmSet = new Set();

const pruneIfNeeded = (key) => {
  if (!firmSet.has(key)) {
    firmSet.add(key);
    firmOrder.push(key);
  }
  if (firmOrder.length > MAX_FIRM_TRACKING) {
    const oldest = firmOrder.shift();
    firmSet.delete(oldest);
    delete metrics.requests[oldest];
    delete metrics.lastError[oldest];
    delete metrics.lastInvariant[oldest];
    delete metrics.lastRateLimit[oldest];
  }
};

const recordRequest = (req) => {
  const key = firmKey(req?.firmId);
  pruneIfNeeded(key);
  metrics.requests[key] = (metrics.requests[key] || 0) + 1;
};

const recordError = (req, error) => {
  const key = firmKey(req?.firmId);
  pruneIfNeeded(key);
  metrics.lastError[key] = {
    at: new Date().toISOString(),
    route: req?.originalUrl || req?.url || null,
    requestId: req?.requestId || null,
    message: error?.message || String(error),
  };
};

const recordInvariantViolation = (req, reason) => {
  const key = firmKey(req?.firmId);
  pruneIfNeeded(key);
  metrics.lastInvariant[key] = {
    at: new Date().toISOString(),
    route: req?.originalUrl || req?.url || null,
    requestId: req?.requestId || null,
    reason,
  };
};

const recordRateLimitHit = (req, endpoint) => {
  const key = firmKey(req?.firmId);
  pruneIfNeeded(key);
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
    firmId: key === NO_FIRM_ID ? null : key,
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
