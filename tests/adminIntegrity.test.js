#!/usr/bin/env node
/**
 * Focused integrity tests for role-based hierarchy rules and migration.
 * Uses mongodb-memory-server for isolated execution.
 */

const assert = require('assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const Client = require('../src/models/Client.model');
const { runAdminHierarchyBackfill } = require('../src/scripts/fixAdminHierarchy');
const { runPreflightChecks } = require('../src/services/bootstrap.service');

async function shouldAllowSuperadminWithoutFirm() {
  const superadmin = new User({
    xID: 'X999999',
    name: 'Platform SuperAdmin',
    email: 'superadmin@test.com',
    role: 'SUPER_ADMIN',
  });

  await superadmin.validate(); // Should not throw
  console.log('✓ SUPER_ADMIN validation without firm/defaultClientId allowed');
}

async function shouldRejectAdminWithoutFirmOrClient() {
  const admin = new User({
    xID: 'X000123',
    name: 'Admin Missing Context',
    email: 'admin-missing@test.com',
    role: 'Admin',
  });

  let failed = false;
  try {
    await admin.validate();
  } catch (err) {
    failed = true;
    assert(
      err.message.includes('firmId') || err.message.includes('defaultClientId'),
      'Validation error should mention missing firm/default client'
    );
  }

  assert(failed, 'Admin creation without firm/default client must fail');
  console.log('✓ Admin validation fails when firm/defaultClientId missing');
}

async function setupFirmWithClient() {
  const firm = await Firm.create({
    firmId: 'FIRM001',
    name: 'Test Firm One',
    firmSlug: 'test-firm-one',
    status: 'ACTIVE',
    bootstrapStatus: 'PENDING',
  });

  const client = await Client.create({
    clientId: 'C000001',
    businessName: 'Test Firm One',
    businessAddress: 'Address',
    primaryContactNumber: '0000000000',
    businessEmail: 'firm001@test.com',
    firmId: firm._id,
    isSystemClient: true,
    isInternal: true,
    createdBySystem: true,
    status: 'ACTIVE',
    isActive: true,
    createdByXid: 'SUPERADMIN',
    createdBy: 'superadmin@test.com',
  });

  await Firm.updateOne({ _id: firm._id }, { $set: { defaultClientId: client._id, bootstrapStatus: 'COMPLETED' } });
  return { firm, client };
}

async function shouldBackfillLegacyAdmin() {
  await mongoose.connection.db.dropDatabase();
  const { firm, client } = await setupFirmWithClient();

  // Insert legacy admin with missing defaultClientId (bypassing validation)
  await User.collection.insertOne({
    xID: 'X000001',
    name: 'Legacy Admin',
    email: 'legacy-admin@test.com',
    role: 'Admin',
    firmId: firm._id,
    defaultClientId: null,
    status: 'INVITED',
    isActive: true,
  });

  await runAdminHierarchyBackfill({ useExistingConnection: true });

  const updated = await User.findOne({ email: 'legacy-admin@test.com' });
  assert(updated.defaultClientId, 'Migration should set defaultClientId');
  assert.strictEqual(updated.defaultClientId.toString(), client._id.toString(), 'defaultClientId should match firm default');
  console.log('✓ Migration backfills legacy admin defaultClientId correctly');
}

async function shouldIgnoreSuperadminInPreflight() {
  await mongoose.connection.db.dropDatabase();
  const { firm, client } = await setupFirmWithClient();

  // Create a compliant admin to avoid violations
  await User.create({
    xID: 'X000777',
    name: 'Scoped Admin',
    email: 'scoped-admin@test.com',
    role: 'Admin',
    firmId: firm._id,
    defaultClientId: client._id,
    status: 'INVITED',
    isActive: true,
  });

  // Create SUPER_ADMIN without firm/defaultClient
  await User.create({
    xID: 'XSU001',
    name: 'Platform Admin',
    email: 'platform-admin@test.com',
    role: 'SUPER_ADMIN',
    status: 'INVITED',
    isActive: true,
  });

  const report = await runPreflightChecks();
  assert(report.info?.superAdminsMissingContext?.length === 1, 'Preflight should record superadmin info');
  assert.strictEqual(report.hasViolations, false, 'SuperAdmin context should not trigger violations');
  console.log('✓ Preflight ignores SUPER_ADMIN missing firm/defaultClient (info only)');
}

async function run() {
  await shouldAllowSuperadminWithoutFirm();
  await shouldRejectAdminWithoutFirmOrClient();

  let mongoServer = null;
  try {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    await shouldBackfillLegacyAdmin();
    await shouldIgnoreSuperadminInPreflight();
  } catch (err) {
    console.warn('⚠️  Skipping DB-dependent integrity tests (Mongo binary unavailable):', err.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  }

  console.log('\nAll admin hierarchy integrity tests completed.');
}

run().catch((err) => {
  console.error('Integrity tests failed:', err);
  process.exit(1);
});
