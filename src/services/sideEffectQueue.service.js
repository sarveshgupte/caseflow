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

const attachRecorder = (req) => {
  if (!req) return;
  if (!req._pendingSideEffects) {
    req._pendingSideEffects = [];
  }
};

const enqueueAfterCommit = (req, effect) => {
  if (!req) {
    return enqueue(effect);
  }
  attachRecorder(req);
  const normalized = normalizeEffect(effect);
  req._pendingSideEffects.push(normalized);
  return normalized.id;
};

const flushRequestEffects = (req) => {
  if (!req?._pendingSideEffects?.length) return;
  const shouldRun = !req.transactionActive || req.transactionCommitted;
  if (!shouldRun) {
    log.warn('SIDE_EFFECT_SKIPPED_ROLLBACK', { requestId: req.requestId, count: req._pendingSideEffects.length });
    req._pendingSideEffects = [];
    return;
  }
  const effects = req._pendingSideEffects.splice(0, req._pendingSideEffects.length);
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
