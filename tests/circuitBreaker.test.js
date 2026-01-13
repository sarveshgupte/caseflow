#!/usr/bin/env node
const assert = require('assert');
const {
  allow,
  recordFailure,
  recordSuccess,
  configureBreaker,
  getSnapshot,
} = require('../src/services/circuitBreaker.service');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function testBreakerOpenAndRecovery() {
  configureBreaker('test-breaker', { failureThreshold: 2, cooldownMs: 20 });

  recordFailure('test-breaker');
  assert.strictEqual(allow('test-breaker'), true, 'Breaker should allow after first failure');

  recordFailure('test-breaker');
  assert.strictEqual(allow('test-breaker'), false, 'Breaker should short-circuit when open');

  await wait(25);
  assert.strictEqual(allow('test-breaker'), true, 'Breaker should allow after cooldown (half-open)');

  recordSuccess('test-breaker');
  const snapshot = getSnapshot().find((b) => b.name === 'test-breaker');
  assert(snapshot && snapshot.state === 'CLOSED', 'Breaker should close after success');
}

async function run() {
  try {
    await testBreakerOpenAndRecovery();
    console.log('Circuit breaker tests passed.');
  } catch (err) {
    console.error('Circuit breaker tests failed:', err);
    process.exit(1);
  }
}

run();
