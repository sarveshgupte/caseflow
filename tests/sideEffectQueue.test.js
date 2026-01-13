#!/usr/bin/env node
const assert = require('assert');
const {
  enqueueAfterCommit,
  flushRequestEffects,
  reset,
} = require('../src/services/sideEffectQueue.service');

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

async function testSideEffectsSkipOnRollback() {
  reset();
  let executed = false;
  const req = { transactionActive: true, transactionCommitted: false, requestId: 'r1' };
  enqueueAfterCommit(req, {
    type: 'TEST',
    execute: async () => { executed = true; },
  });
  flushRequestEffects(req);
  await wait(20);
  assert.strictEqual(executed, false, 'Side effects should not run when transaction rolled back');
}

async function testSideEffectsRunAfterCommit() {
  reset();
  let executed = false;
  const req = { transactionActive: true, transactionCommitted: true, requestId: 'r2' };
  enqueueAfterCommit(req, {
    type: 'TEST',
    execute: async () => { executed = true; },
  });
  flushRequestEffects(req);
  await wait(20);
  assert.strictEqual(executed, true, 'Side effects should run after commit');
}

async function run() {
  try {
    await testSideEffectsSkipOnRollback();
    await testSideEffectsRunAfterCommit();
    console.log('Side effect queue tests passed.');
  } catch (err) {
    console.error('Side effect queue tests failed:', err);
    process.exit(1);
  }
}

run();
