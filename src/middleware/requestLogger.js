/**
 * Request Logger Middleware
 * Logs all incoming requests for audit trail
 */

const { randomUUID } = require('crypto');
const { maskSensitiveObject } = require('../utils/pii');
const log = require('../utils/log');
const { recordRequest } = require('../utils/operationalMetrics');

const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  if (!req.requestId) {
    req.requestId = randomUUID();
  }
  res.setHeader('X-Request-ID', req.requestId);
  const { method, originalUrl, ip } = req;
  recordRequest(req);
  log.info('REQUEST_RECEIVED', { req, timestamp, ip });
  
  // Log request body for POST/PUT/PATCH requests (excluding sensitive data).
  // NOTE: Never log raw request bodies/headers; always pass through maskSensitiveObject to avoid PII leaks.
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const sanitizedBody = maskSensitiveObject({ ...(req.body || {}) });
    log.info('REQUEST_BODY', { req, body: sanitizedBody });
  }

  // Log query parameters with masking applied
  if (req.query && Object.keys(req.query).length > 0) {
    const sanitizedQuery = maskSensitiveObject({ ...req.query });
    log.info('REQUEST_QUERY', { req, query: sanitizedQuery });
  }
  // If header logging is ever added, it must call maskSensitiveObject(req.headers) before outputting.
  
  next();
};

module.exports = requestLogger;
