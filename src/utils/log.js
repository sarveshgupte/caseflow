const { randomUUID } = require('crypto');

/**
 * Structured logging helper to standardize log shape
 * All logs include: requestId, firmId (optional), userXID (optional), route, severity
 */
const buildContext = (level, event, meta = {}) => {
  const { req, severity, ...rest } = meta;
  const resolvedRequestId = meta.requestId || req?.requestId || req?.id || randomUUID();
  if (req && !req.requestId) {
    req.requestId = resolvedRequestId;
  }
  const base = {
    timestamp: new Date().toISOString(),
    severity: (severity || level).toUpperCase(),
    event,
    requestId: resolvedRequestId,
    firmId: meta.firmId || req?.firmId || req?.firm?.id || null,
    userXID: meta.userXID || req?.user?.xID || req?.user?.id || null,
    route: meta.route || req?.originalUrl || req?.url || null,
    ...rest,
  };
  return base;
};

const logAtLevel = (level, event, meta = {}) => {
  const context = buildContext(level, event, meta);
  const { req, ...safeContext } = context;
  const prefix = `[${safeContext.severity}][${safeContext.requestId || 'no-req'}][${safeContext.firmId || 'no-firm'}][${safeContext.route || 'n/a'}]`;
  const logger = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  logger(`${prefix} ${event}`, safeContext);
};

module.exports = {
  info: (event, meta) => logAtLevel('info', event, meta),
  warn: (event, meta) => logAtLevel('warn', event, meta),
  error: (event, meta) => logAtLevel('error', event, meta),
};
