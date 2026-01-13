const crypto = require('crypto');

const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const idempotencyCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let inMemoryWarningLogged = false;

const hash = (value) => crypto.createHash('sha256').update(value || '').digest('hex');

const buildFingerprint = (req) => {
  const bodyHash = hash(JSON.stringify(req.body || {}));
  const route = req.originalUrl || req.path || '';
  const firmId = req.firmId || req.user?.firmId || 'none';
  const userId = req.user?._id || req.user?.id || req.user?.xID || req.user?.email || 'anonymous';
  return hash([req.method, route, firmId, userId, bodyHash].join('|'));
};

const idempotencyMiddleware = (req, res, next) => {
  if (!mutatingMethods.has(req.method)) {
    return next();
  }

  const key = (req.headers && req.headers['idempotency-key']) || req.get?.('Idempotency-Key');
  if (!key) {
    return res.status(400).json({ error: 'idempotency_key_required' });
  }

  if (!inMemoryWarningLogged && process.env.NODE_ENV === 'production') {
    console.warn('[idempotencyMiddleware] Using in-memory idempotency cache; enable shared store for multi-instance deployments.');
    inMemoryWarningLogged = true;
  }

  const fingerprint = buildFingerprint(req);
  const existing = idempotencyCache.get(key);

  if (existing) {
    if (existing.expiresAt && existing.expiresAt < Date.now()) {
      idempotencyCache.delete(key);
    } else {
      if (existing.fingerprint !== fingerprint) {
        return res.status(409).json({ error: 'idempotency_key_conflict' });
      }
      if (existing.response) {
        if (res.set) {
          res.set('Idempotent-Replay', 'true');
        }
        return res.status(existing.response.status).json(existing.response.body);
      }
    }
  }

  const record = existing || { fingerprint };
  record.expiresAt = Date.now() + CACHE_TTL_MS;
  idempotencyCache.set(key, record);

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    record.response = {
      status: res.statusCode || 200,
      body: payload,
    };
    idempotencyCache.set(key, record);
    return originalJson(payload);
  };

  return next();
};

const resetIdempotencyCache = () => idempotencyCache.clear();

module.exports = {
  idempotencyMiddleware,
  resetIdempotencyCache,
  _idempotencyCache: idempotencyCache,
};
