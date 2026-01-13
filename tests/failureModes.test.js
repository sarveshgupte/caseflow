#!/usr/bin/env node
const assert = require('assert');
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { createFirmHierarchy, FirmBootstrapError, defaultDeps } = require('../src/services/firmBootstrap.service');
const { validateEnv } = require('../src/config/validateEnv');
const { runReadinessChecks } = require('../src/controllers/health.controller');
const Firm = require('../src/models/Firm.model');
const Client = require('../src/models/Client.model');
const User = require('../src/models/User.model');
const degradedGuard = require('../src/middleware/degradedGuard');
const { markDegraded, resetState, getState } = require('../src/services/systemState.service');

const setBaseEnv = async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra-test';
  if (!process.env.SUPERADMIN_PASSWORD_HASH) {
    process.env.SUPERADMIN_PASSWORD_HASH = await bcrypt.hash('TestPassword123!', 10);
  }
  process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X123456';
  process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@test.com';
  process.env.DISABLE_GOOGLE_AUTH = process.env.DISABLE_GOOGLE_AUTH || 'true';
};

async function testTransactionalRollback() {
  console.log('\n[Test] Firm bootstrap rollback on failure');
  await setBaseEnv();
  let replset;
  try {
    replset = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
  } catch (error) {
    console.warn('⚠️  Skipping rollback test (MongoDB binary unavailable):', error.message);
    return;
  }
  const uri = replset.getUri();
  process.env.MONGODB_URI = uri;
  try {
    await mongoose.connect(uri);

    let failed = false;
    try {
      await createFirmHierarchy({
        payload: { name: 'Rollback Co', adminName: 'Alice', adminEmail: 'alice@rollback.test' },
        deps: { ...defaultDeps, generateNextClientId: async () => { throw new Error('forced failure'); } },
        requestId: 'rollback-test',
      });
    } catch (error) {
      failed = true;
      assert(error instanceof FirmBootstrapError, 'Should throw FirmBootstrapError on failure');
    }
    assert(failed, 'Bootstrap should fail intentionally');

    const firmCount = await Firm.countDocuments();
    const clientCount = await Client.countDocuments();
    const userCount = await User.countDocuments();
    assert.strictEqual(firmCount, 0, 'Firm should not persist after rollback');
    assert.strictEqual(clientCount, 0, 'Client should not persist after rollback');
    assert.strictEqual(userCount, 0, 'Admin should not persist after rollback');

    console.log('✓ Transaction rollback leaves no partial data');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await replset.stop();
  }
}

function testEnvValidationFailure() {
  console.log('\n[Test] Startup env validation blocks missing config');
  const originalJwt = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  const result = validateEnv({ exitOnError: false });
  assert.strictEqual(result.valid, false, 'Env validation should fail');
  assert(result.errors.some(e => e.field === 'JWT_SECRET'), 'Missing JWT_SECRET should be reported');
  process.env.JWT_SECRET = originalJwt || 'supersecretjwtvalue';
  console.log('✓ Env validation reports missing variables');
}

async function testReadinessWhenDbDown() {
  console.log('\n[Test] Readiness fails when DB is down');
  await setBaseEnv();
  const originalUri = process.env.MONGODB_URI;
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db-down';
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  try {
    const readiness = await runReadinessChecks();
    assert.strictEqual(readiness.ready, false, 'Readiness should fail without DB connection');
    assert.strictEqual(readiness.checks.db, 'disconnected');
    assert.strictEqual(readiness.systemState.state, 'DEGRADED');
    console.log('✓ Readiness reports not ready when DB is unavailable');
  } finally {
    process.env.MONGODB_URI = originalUri;
  }
}

async function testFeatureFlagBlocksFirmCreation() {
  console.log('\n[Test] Feature flag blocks firm creation');
  await setBaseEnv();
  process.env.DISABLE_FIRM_CREATION = 'true';
  let blocked = false;
  try {
    await createFirmHierarchy({
      payload: { name: 'Flag Co', adminName: 'Bob', adminEmail: 'bob@flag.test' },
      requestId: 'flag-test',
    });
  } catch (error) {
    blocked = true;
    assert(error instanceof FirmBootstrapError, 'Should throw FirmBootstrapError when disabled');
    assert.strictEqual(error.statusCode, 503, 'Should return service unavailable status');
  }
  assert(blocked, 'Feature flag should block firm creation');
  delete process.env.DISABLE_FIRM_CREATION;
  console.log('✓ Firm creation is blocked when feature flag is set');
}

async function testReadinessReportsFeatureFlags() {
  console.log('\n[Test] Readiness reports disabled feature flags');
  await setBaseEnv();
  process.env.DISABLE_FIRM_CREATION = 'true';
  process.env.DISABLE_FILE_UPLOADS = 'true';
  const readiness = await runReadinessChecks();
  assert.strictEqual(readiness.checks.featureFlags.firmCreation, 'disabled');
  assert.strictEqual(readiness.checks.featureFlags.fileUploads, 'disabled');
  assert.strictEqual(readiness.systemState.state, 'DEGRADED');
  delete process.env.DISABLE_FIRM_CREATION;
  delete process.env.DISABLE_FILE_UPLOADS;
  console.log('✓ Readiness exposes feature flag state');
}

async function testDbLatencyCausesDegraded() {
  console.log('\n[Test] DB latency degradation marks not ready');
  await setBaseEnv();
  const originalConnectionDescriptor = Object.getOwnPropertyDescriptor(mongoose, 'connection');
  const originalFirmCount = Firm.estimatedDocumentCount;
  const originalUserCount = User.estimatedDocumentCount;
  const mockedConnection = {
    readyState: 1,
    db: {
      admin: () => ({
        ping: async () => new Promise((resolve) => setTimeout(resolve, 800)),
      }),
    },
  };
  Object.defineProperty(mongoose, 'connection', { value: mockedConnection, configurable: true, writable: true });
  Firm.estimatedDocumentCount = async () => 0;
  User.estimatedDocumentCount = async () => 0;
  try {
    const readiness = await runReadinessChecks();
    assert.strictEqual(readiness.ready, false);
    assert.strictEqual(readiness.checks.db, 'degraded');
    assert.strictEqual(readiness.systemState.state, 'DEGRADED');
    console.log('✓ DB latency degradation is not ready');
  } finally {
    if (originalConnectionDescriptor) {
      Object.defineProperty(mongoose, 'connection', originalConnectionDescriptor);
    }
    Firm.estimatedDocumentCount = originalFirmCount;
    User.estimatedDocumentCount = originalUserCount;
  }
}

async function testDegradedAutoRecovers() {
  console.log('\n[Test] System recovers from degraded state when checks pass');
  await setBaseEnv();
  resetState();
  markDegraded('manual_test');
  const originalConnectionDescriptor = Object.getOwnPropertyDescriptor(mongoose, 'connection');
  const originalFirmCount = Firm.estimatedDocumentCount;
  const originalUserCount = User.estimatedDocumentCount;
  const mockedConnection = {
    readyState: 1,
    db: {
      admin: () => ({
        ping: async () => {},
      }),
    },
  };
  Object.defineProperty(mongoose, 'connection', { value: mockedConnection, configurable: true, writable: true });
  Firm.estimatedDocumentCount = async () => 0;
  User.estimatedDocumentCount = async () => 0;
  try {
    const readiness = await runReadinessChecks();
    assert.strictEqual(readiness.ready, true);
    assert.strictEqual(readiness.systemState.state, 'NORMAL');
    console.log('✓ System auto-recovers to NORMAL when checks pass');
  } finally {
    if (originalConnectionDescriptor) {
      Object.defineProperty(mongoose, 'connection', originalConnectionDescriptor);
    }
    Firm.estimatedDocumentCount = originalFirmCount;
    User.estimatedDocumentCount = originalUserCount;
  }
}

function testDegradedGuardBlocksWrites() {
  console.log('\n[Test] Degraded guard blocks writes but allows reads');
  resetState();
  markDegraded('test', { reason: 'unit' });
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  degradedGuard({ method: 'GET' }, { status: () => ({ json: () => {} }) }, next);
  assert.strictEqual(nextCalled, true, 'Read-only requests should pass');

  let statusCode = null;
  let body = null;
  degradedGuard(
    { method: 'POST' },
    {
      status: (code) => {
        statusCode = code;
        return {
          json: (payload) => { body = payload; },
        };
      },
    },
    () => {}
  );
  assert.strictEqual(statusCode, 503);
  assert.strictEqual(body.error, 'system_degraded');
  assert.strictEqual(getState().state, 'DEGRADED');
  resetState();
  console.log('✓ Degraded guard blocks writes');
}

async function run() {
  try {
    await testTransactionalRollback();
    testEnvValidationFailure();
    await testReadinessWhenDbDown();
    await testFeatureFlagBlocksFirmCreation();
    await testReadinessReportsFeatureFlags();
    await testDbLatencyCausesDegraded();
    await testDegradedAutoRecovers();
    testDegradedGuardBlocksWrites();
    console.log('\nAll failure-mode tests passed.');
  } catch (err) {
    console.error('Failure-mode tests failed:', err);
    process.exit(1);
  }
}

run();
