const { randomUUID } = require('crypto');
const log = require('../utils/log');
const { recordInvariantViolation } = require('../utils/operationalMetrics');

/**
 * Invariant Guard Middleware
 * Enforces required invariants per route and fails loudly on violations.
 */
const invariantGuard = (rules = {}) => (req, res, next) => {
  const { requireFirm, forbidSuperAdmin } = rules;
  req.requestId = req.requestId || randomUUID();

  if (requireFirm && !req.firmId) {
    const error = new Error('Invariant violated: firmId required');
    error.statusCode = 400;
    recordInvariantViolation(req, error.message);
    log.error('INVARIANT_BROKEN', { req, reason: error.message });
    return next(error);
  }

  if (forbidSuperAdmin && req.isSuperAdmin) {
    const error = new Error('Invariant violated: SuperAdmin on firm route');
    error.statusCode = 403;
    recordInvariantViolation(req, error.message);
    log.error('INVARIANT_BROKEN', { req, reason: error.message });
    return next(error);
  }

  return next();
};

module.exports = invariantGuard;
