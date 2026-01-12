#!/usr/bin/env node

/**
 * Lightweight operability test for invariant guard and metrics
 */

const assert = require('assert');
const invariantGuard = require('../src/middleware/invariantGuard');
const {
  recordRequest,
  recordError,
  recordInvariantViolation,
  recordRateLimitHit,
  getDashboardSnapshot,
} = require('../src/utils/operationalMetrics');

const run = async () => {
  // Test invariant guard requireFirm
  let thrown = false;
  const guard = invariantGuard({ requireFirm: true, forbidSuperAdmin: true });
  await guard({ requestId: 'req-1' }, {}, (err) => {
    if (err) thrown = true;
  });
  assert.strictEqual(thrown, true, 'Invariant guard should throw when firm missing');

  // Test operational metrics aggregation
  const req = { firmId: 'firm-1', originalUrl: '/test', requestId: 'req-2' };
  recordRequest(req);
  recordError(req, new Error('boom'));
  recordInvariantViolation(req, 'missing something');
  recordRateLimitHit(req, '/test');

  const snapshot = getDashboardSnapshot();
  const firmRow = snapshot.find((row) => row.firmId === 'firm-1');
  assert.ok(firmRow, 'Dashboard should include firm row');
  assert.ok(firmRow.totalRequests >= 1, 'Requests should be counted');
  assert.ok(firmRow.lastError, 'Last error should be captured');
  assert.ok(firmRow.lastInvariantViolation, 'Last invariant should be captured');
  assert.ok(firmRow.lastRateLimit, 'Last rate limit should be captured');
};

run()
  .then(() => {
    console.log('✓ operability tests passed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ operability tests failed', err);
    process.exit(1);
  });
