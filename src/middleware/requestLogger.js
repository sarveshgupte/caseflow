/**
 * Request Logger Middleware
 * Logs all incoming requests for audit trail
 */

const { maskSensitiveObject } = require('../utils/pii');

const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const { method, originalUrl, ip } = req;
  
  console.log(`[${timestamp}] ${method} ${originalUrl} - IP: ${ip}`);
  
  // Log request body for POST/PUT/PATCH requests (excluding sensitive data).
  // NOTE: Never log raw request bodies/headers; always pass through maskSensitiveObject to avoid PII leaks.
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const sanitizedBody = maskSensitiveObject({ ...(req.body || {}) });
    console.log('Request Body (masked):', JSON.stringify(sanitizedBody, null, 2));
  }

  // Log query parameters with masking applied
  if (req.query && Object.keys(req.query).length > 0) {
    const sanitizedQuery = maskSensitiveObject({ ...req.query });
    console.log('Query Params (masked):', JSON.stringify(sanitizedQuery, null, 2));
  }
  // If header logging is ever added, it must call maskSensitiveObject(req.headers) before outputting.
  
  next();
};

module.exports = requestLogger;
