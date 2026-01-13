const { randomUUID } = require('crypto');
const log = require('../utils/log');
const metricsService = require('../services/metrics.service');
const { enqueueAfterCommit, attachRecorder, flushRequestEffects } = require('../services/sideEffectQueue.service');

const requestLifecycle = (req, res, next) => {
  const startTime = Date.now();
  if (!req.requestId) {
    req.requestId = randomUUID();
  }
  res.setHeader('X-Request-ID', req.requestId);
  attachRecorder(req);

  const finalize = (reason) => {
    if (res._lifecycleLogged) return;
    res._lifecycleLogged = true;
    const durationMs = Date.now() - startTime;
    enqueueAfterCommit(req, {
      type: 'METRICS_LATENCY',
      payload: { route: req.originalUrl || req.url, durationMs },
      execute: async () => metricsService.recordLatency(durationMs),
    });
    log.info('REQUEST_LIFECYCLE', {
      req,
      method: req.method,
      route: req.originalUrl || req.url || null,
      actor: req.user?.xID || req.user?.id || null,
      role: req.user?.role || null,
      firmId: req.firmId || req.firm?.id || req.user?.firmId || null,
      startTime: new Date(startTime).toISOString(),
      durationMs,
      status: res.statusCode,
      lifecycleEnd: reason,
      transactionCommitted: !!req.transactionCommitted,
    });
    flushRequestEffects(req);
  };

  res.once('finish', () => finalize('finish'));
  res.once('close', () => finalize('close'));

  next();
};

module.exports = requestLifecycle;
