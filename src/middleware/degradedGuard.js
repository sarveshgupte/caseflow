const { isDegraded, getState } = require('../services/systemState.service');
const metricsService = require('../services/metrics.service');

const READ_ONLY_METHODS = ['GET', 'HEAD', 'OPTIONS', 'TRACE'];

const degradedGuard = (req, res, next) => {
  const path = req.originalUrl || req.url || '';
  if (path.startsWith('/health') || path.startsWith('/metrics')) return next();
  if (!isDegraded()) return next();
  if (READ_ONLY_METHODS.includes(req.method)) return next();

  metricsService.recordError(503);
  return res.status(503).json({
    success: false,
    error: 'system_degraded',
    message: 'System is in degraded mode. Write operations are temporarily blocked.',
    systemState: getState(),
  });
};

module.exports = degradedGuard;
