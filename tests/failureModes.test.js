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

const setBaseEnv = () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
  process.env.SUPERADMIN_PASSWORD_HASH = process.env.SUPERADMIN_PASSWORD_HASH || bcrypt.hashSync('TestPassword123!', 10);
  process.env.SUPERADMIN_XID = process.env.SUPERADMIN_XID || 'X999999';
  process.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || 'superadmin@test.com';
  process.env.DISABLE_GOOGLE_AUTH = process.env.DISABLE_GOOGLE_AUTH || 'true';
};

async function testTransactionalRollback() {
  console.log('\n[Test] Firm bootstrap rollback on failure');
  setBaseEnv();
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

  await mongoose.disconnect();
  await replset.stop();
  console.log('✓ Transaction rollback leaves no partial data');
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
  setBaseEnv();
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db-down';
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  const readiness = await runReadinessChecks();
  assert.strictEqual(readiness.ok, false, 'Readiness should fail without DB connection');
  console.log('✓ Readiness reports not ready when DB is unavailable');
}

async function testFeatureFlagBlocksFirmCreation() {
  console.log('\n[Test] Feature flag blocks firm creation');
  setBaseEnv();
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

async function run() {
  try {
    await testTransactionalRollback();
    testEnvValidationFailure();
    await testReadinessWhenDbDown();
    await testFeatureFlagBlocksFirmCreation();
    console.log('\nAll failure-mode tests passed.');
  } catch (err) {
    console.error('Failure-mode tests failed:', err);
    process.exit(1);
  }
}

run();
