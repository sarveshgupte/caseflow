const metrics = {
  requests: {},
  errors: {},
  authFailures: 0,
  rateLimitHits: {},
};

const normalizeRoute = (route) => {
  if (!route) return 'unknown';
  return route.split('?')[0];
};

const recordRequest = (route) => {
  const key = normalizeRoute(route);
  metrics.requests[key] = (metrics.requests[key] || 0) + 1;
};

const recordError = (statusCode) => {
  const code = String(statusCode || 'unknown');
  metrics.errors[code] = (metrics.errors[code] || 0) + 1;
};

const recordAuthFailure = (route) => {
  metrics.authFailures += 1;
  recordError(401);
  recordRequest(normalizeRoute(route));
};

const recordRateLimitHit = (limiterName) => {
  const key = limiterName || 'unknown';
  metrics.rateLimitHits[key] = (metrics.rateLimitHits[key] || 0) + 1;
};

const getSnapshot = () => ({
  requests: { ...metrics.requests },
  errors: { ...metrics.errors },
  authFailures: metrics.authFailures,
  rateLimitHits: { ...metrics.rateLimitHits },
});

module.exports = {
  recordRequest,
  recordError,
  recordAuthFailure,
  recordRateLimitHit,
  getSnapshot,
};
