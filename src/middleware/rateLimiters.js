const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');

/**
 * Rate Limiting Middleware for Docketra
 * 
 * Protects API from abuse:
 * - Brute-force attacks on authentication
 * - High-frequency scraping
 * - Attachment download abuse
 * - Search endpoint flooding
 * - Accidental DoS from buggy clients
 * 
 * Design Principles:
 * - Rate limiting lives in middleware only (no controller logic)
 * - Limits differ by endpoint sensitivity
 * - Authenticated users != unlimited access
 * - SuperAdmin is also rate limited
 * - Limits are contextual (IP + user + firm-aware)
 * - Abuse attempts are logged
 * - Fail-open: allow requests if Redis unavailable (never crash or block)
 * - Redis is optional infrastructure - app works without it
 * 
 * Categories:
 * 1. Authentication endpoints (IP-based): 5 req/min
 * 2. Case read operations (user+firm): 60 req/min
 * 3. Case mutation operations (user+firm): 30 req/min
 * 4. Attachment access (user): 10 req/min
 * 5. Search/filter endpoints (user): 20 req/min
 * 6. SuperAdmin endpoints (xID): Higher limits but still limited
 */

/**
 * Abuse event logger
 * Logs all 429 rate limit violations for forensic analysis
 * 
 * @param {Object} req - Express request object
 * @param {string} limiterName - Name of the rate limiter that triggered
 */
const logAbuseEvent = (req, limiterName) => {
  const event = {
    timestamp: new Date().toISOString(),
    limiterName,
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    route: `${req.method} ${req.originalUrl || req.url}`,
    userId: req.user?.xID || req.user?._id || 'unauthenticated',
    firmId: req.user?.firmId || 'none',
    role: req.user?.role || 'none',
    userAgent: req.get('user-agent') || 'unknown',
  };
  
  console.warn('[RATE_LIMIT] Abuse detected:', JSON.stringify(event));
};

/**
 * Standardized 429 response handler
 * Returns consistent error format for all rate limit violations
 * 
 * @param {string} limiterName - Name of the rate limiter
 * @returns {Function} Express handler function
 */
const createRateLimitHandler = (limiterName) => {
  return (req, res) => {
    logAbuseEvent(req, limiterName);
    
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down.',
      error: 'RATE_LIMIT_EXCEEDED',
      limiter: limiterName,
      retryAfter: res.getHeader('Retry-After'),
    });
  };
};

/**
 * Create Redis store or use in-memory store (fail-open design)
 * Never crashes - returns undefined if Redis is unavailable
 * 
 * @returns {Object|undefined} RedisStore instance or undefined for in-memory
 */
const createStore = () => {
  const redisClient = getRedisClient();
  
  // Log Redis state for diagnostics
  const redisUrlPresent = !!process.env.REDIS_URL;
  const redisReady = redisClient && (redisClient.status === 'ready' || redisClient.status === 'connecting');
  
  console.log(`[RATE_LIMIT] REDIS_URL present: ${redisUrlPresent}`);
  console.log(`[RATE_LIMIT] Redis client ready: ${!!redisReady}`);
  
  // Only create Redis store if client exists
  // Even if not ready, let RedisStore handle reconnections
  if (!redisClient) {
    console.warn('[RATE_LIMIT] Redis not available - using memory store');
    console.log('[RATE_LIMIT] Redis store enabled: false');
    return undefined; // Fall back to memory store
  }
  
  try {
    // Create Redis store with correct API for rate-limit-redis v4+
    // RedisStore will handle Redis connection issues internally
    const store = new RedisStore({
      sendCommand: (...args) => redisClient.call(...args),
      prefix: 'ratelimit:',
    });
    
    console.log('[RATE_LIMIT] Redis store enabled: true');
    return store;
  } catch (err) {
    console.error('[RATE_LIMIT] Redis store init failed:', err.message);
    console.log('[RATE_LIMIT] Redis store enabled: false');
    return undefined; // Fall back to memory store
  }
};

/**
 * Create rate limiter with common configuration
 * Fail-open design: allows requests if Redis is down, but enforces limits when working
 * 
 * @param {Object} config - Rate limiter configuration
 * @param {number} config.windowMs - Time window in milliseconds
 * @param {number} config.max - Maximum requests per window
 * @param {Function} config.keyGenerator - Function to generate rate limit key
 * @param {string} config.name - Name of the rate limiter (for logging)
 * @returns {Function} Express middleware function
 */
const createLimiter = ({ windowMs, max, keyGenerator, name }) => {
  const store = createStore();
  
  return rateLimit({
    windowMs,
    max,
    keyGenerator,
    store, // undefined = memory fallback (fail-open for Redis issues)
    standardHeaders: true,  // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,   // Disable X-RateLimit-* headers
    handler: createRateLimitHandler(name), // Standard 429 response when limits exceeded
    // Never skip rate limiting based on Redis state
    skip: () => false,
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
    // Disable IPv6 validation (we handle it in our custom key generators)
    validate: false,
  });
};

/**
 * Authentication Limiter (IP-based)
 * Protects against credential stuffing and brute-force attacks
 * 
 * Applied to:
 * - POST /api/auth/login
 * - POST /api/auth/forgot-password
 * - POST /api/auth/set-password
 * - POST /api/auth/reset-password-with-token
 * 
 * Limit: 5 requests per minute per IP
 */
const authLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
  name: 'authLimiter',
});

/**
 * User Read Limiter (User + Firm scoped)
 * Limits read operations on case data
 * 
 * Applied to:
 * - GET /api/cases
 * - GET /api/cases/:caseId
 * - GET /api/cases/:caseId/history
 * - GET /api/cases/my-*
 * 
 * Limit: 60 requests per minute per user+firm
 */
const userReadLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  keyGenerator: (req) => {
    if (!req.user) return req.ip || 'unknown';
    const userId = req.user.xID || req.user._id || 'unknown';
    const firmId = req.user.firmId || 'none';
    return `${firmId}:${userId}`;
  },
  name: 'userReadLimiter',
});

/**
 * User Write Limiter (User + Firm scoped)
 * Limits mutation operations on cases
 * 
 * Applied to:
 * - POST /api/cases
 * - POST /api/cases/:caseId/comments
 * - POST /api/cases/:caseId/pull
 * - PUT /api/cases/:caseId/status
 * - POST /api/cases/:caseId/resolve
 * - POST /api/cases/:caseId/pend
 * - POST /api/cases/:caseId/file
 * - POST /api/cases/:caseId/clone
 * 
 * Limit: 30 requests per minute per user+firm
 */
const userWriteLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  keyGenerator: (req) => {
    if (!req.user) return req.ip || 'unknown';
    const userId = req.user.xID || req.user._id || 'unknown';
    const firmId = req.user.firmId || 'none';
    return `${firmId}:${userId}`;
  },
  name: 'userWriteLimiter',
});

/**
 * Attachment Access Limiter (User scoped)
 * Prevents bandwidth abuse from attachment downloads
 * 
 * Applied to:
 * - GET /api/cases/:caseId/attachments/:attachmentId/view
 * - GET /api/cases/:caseId/attachments/:attachmentId/download
 * - POST /api/cases/:caseId/attachments
 * 
 * Limit: 10 requests per minute per user
 */
const attachmentLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req) => {
    if (!req.user) return req.ip || 'unknown';
    return req.user.xID || req.user._id || 'unknown';
  },
  name: 'attachmentLimiter',
});

/**
 * Search/Filter Limiter (User scoped)
 * Prevents query abuse and expensive database operations
 * 
 * Applied to:
 * - GET /api/search
 * - GET /api/cases?filters=...
 * - GET /api/worklists/*
 * 
 * Limit: 20 requests per minute per user
 */
const searchLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  keyGenerator: (req) => {
    if (!req.user) return req.ip || 'unknown';
    return req.user.xID || req.user._id || 'unknown';
  },
  name: 'searchLimiter',
});

/**
 * SuperAdmin Limiter (xID-based)
 * SuperAdmin has higher limits but is still rate-limited
 * Prevents abuse even from privileged accounts
 * 
 * Applied to:
 * - All /api/superadmin/* endpoints
 * - All /api/admin/* endpoints
 * 
 * Limit: 100 requests per minute per SuperAdmin xID
 */
const superadminLimiter = createLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  keyGenerator: (req) => {
    if (!req.user) return req.ip || 'unknown';
    return req.user.xID || req.user._id || 'admin-unknown';
  },
  name: 'superadminLimiter',
});

module.exports = {
  authLimiter,
  userReadLimiter,
  userWriteLimiter,
  attachmentLimiter,
  searchLimiter,
  superadminLimiter,
};
