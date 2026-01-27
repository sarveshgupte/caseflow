const { randomUUID } = require('crypto');
const log = require('../utils/log');

const queue = [];
const failed = [];
const MAX_FAILED = 10;
const DEFAULT_MAX_RETRIES = 2;
let processing = false;

const normalizeEffect = (effect = {}) => ({
  id: effect.id || randomUUID(),
  type: effect.type || 'SIDE_EFFECT',
  payload: effect.payload || {},
  execute: effect.execute || (async () => {}),
  attempts: effect.attempts || 0,
  maxRetries: effect.maxRetries ?? DEFAULT_MAX_RETRIES,
});

const recordFailure = (effect, error) => {
  failed.unshift({
    id: effect.id,
    type: effect.type,
    payload: effect.payload,
    error: error?.message || String(error),
    at: new Date().toISOString(),
  });
  if (failed.length > MAX_FAILED) {
    failed.pop();
  }
};

const processQueue = async () => {
  if (processing) return;
  processing = true;
  while (queue.length > 0) {
    const effect = queue.shift();
    try {
      await effect.execute();
    } catch (err) {
      recordFailure(effect, err);
      effect.attempts += 1;
      log.warn('SIDE_EFFECT_FAILED', { id: effect.id, type: effect.type, attempts: effect.attempts, error: err.message });
      if (effect.attempts <= effect.maxRetries) {
        queue.push(effect);
      }
    }
  }
  processing = false;
};

const schedule = () => {
  setImmediate(processQueue);
};

const enqueue = (effect) => {
  const normalized = normalizeEffect(effect);
  queue.push(normalized);
  schedule();
  return normalized.id;
};

/**
 * Attach side-effect recorder to request context or Express req object
 * @param {Object} reqOrContext - Express req or request context with _pendingSideEffects array
 */
const attachRecorder = (reqOrContext) => {
  if (!reqOrContext) return;
  if (!reqOrContext._pendingSideEffects) {
    reqOrContext._pendingSideEffects = [];
  }
};

/**
 * Enqueue side effect to run after transaction commit
 * @param {Object} reqOrContext - Express req or plain request context object with:
 *   - _pendingSideEffects: Array to store pending effects
 *   - transactionActive: boolean (optional)
 *   - transactionCommitted: boolean (optional)
 *   - requestId: string (optional, for logging)
 * @param {Object} effect - Effect to enqueue
 * @returns {string} Effect ID
 */
const enqueueAfterCommit = (reqOrContext, effect) => {
  if (!reqOrContext) {
    return enqueue(effect);
  }
  attachRecorder(reqOrContext);
  const normalized = normalizeEffect(effect);
  reqOrContext._pendingSideEffects.push(normalized);
  return normalized.id;
};

/**
 * Flush pending side effects for a request context
 * @param {Object} reqOrContext - Express req or request context
 */
const flushRequestEffects = (reqOrContext) => {
  if (!reqOrContext?._pendingSideEffects?.length) return;
  const shouldRun = !reqOrContext.transactionActive || reqOrContext.transactionCommitted;
  if (!shouldRun) {
    log.warn('SIDE_EFFECT_SKIPPED_ROLLBACK', { requestId: reqOrContext.requestId, count: reqOrContext._pendingSideEffects.length });
    reqOrContext._pendingSideEffects = [];
    return;
  }
  const effects = reqOrContext._pendingSideEffects.splice(0, reqOrContext._pendingSideEffects.length);
  effects.forEach(enqueue);
};

const getQueueDepth = () => queue.length;
const getFailed = () => [...failed];
const reset = () => {
  queue.splice(0, queue.length);
  failed.splice(0, failed.length);
  processing = false;
};

module.exports = {
  enqueue,
  enqueueAfterCommit,
  attachRecorder,
  flushRequestEffects,
  getQueueDepth,
  getFailed,
  reset,
};
