const mongoose = require('mongoose');
const { getState } = require('./systemState.service');
const { isFirmCreationDisabled, isGoogleAuthDisabled, areFileUploadsDisabled } = require('./featureFlags.service');
const { getRedisClient } = require('../config/redis');
const { getIdempotencyCacheSize } = require('../middleware/idempotency.middleware');
const metricsService = require('./metrics.service');
const { getTransactionMetrics } = require('./transactionMonitor.service');
const { getQueueDepth, getFailed } = require('./sideEffectQueue.service');
const { getSnapshot: getBreakerSnapshot, isAnyOpen } = require('./circuitBreaker.service');

const CACHE_TTL_MS = 30 * 1000;
const MAX_DEGRADED_REASONS = 10;
let cached = null;
let cachedAt = 0;

const getRedisStatus = () => {
  const client = getRedisClient();
  if (!client) {
    return { available: false, status: 'unavailable' };
  }
  const lazy = client && client.options && client.options.lazyConnect;
  return {
    available: true,
    status: client.status,
    mode: lazy ? 'lazy' : 'eager',
  };
};

const measureDbLatency = async () => {
  try {
    if (!mongoose.connection?.db) return null;
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    require('./circuitBreaker.service').recordSuccess('mongo');
    return Date.now() - start;
  } catch (err) {
    require('./circuitBreaker.service').recordFailure('mongo');
    return null;
  }
};

const getDiagnosticsSnapshot = async () => {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cached;
  }

  const state = getState();
  const dbLatencyMs = await measureDbLatency();

  cached = {
    systemState: state.state,
    degradedReasons: (state.reasons || []).slice(-MAX_DEGRADED_REASONS),
    featureFlags: [
      { name: 'firmCreation', enabled: !isFirmCreationDisabled() },
      { name: 'googleAuth', enabled: !isGoogleAuthDisabled() },
      { name: 'fileUploads', enabled: !areFileUploadsDisabled() },
    ],
    redis: getRedisStatus(),
    dbLatencyMs,
    idempotencyCacheSize: getIdempotencyCacheSize(),
    transactionFailures: getTransactionMetrics(),
    metrics: metricsService.getSnapshot(),
    circuitBreakers: getBreakerSnapshot(),
    sideEffectQueue: {
      depth: getQueueDepth(),
      failed: getFailed(),
    },
    requestLatency: metricsService.getLatencyPercentiles(),
    circuitOpen: isAnyOpen(),
    generatedAt: new Date().toISOString(),
  };

  cachedAt = Date.now();
  return cached;
};

module.exports = {
  getDiagnosticsSnapshot,
};
