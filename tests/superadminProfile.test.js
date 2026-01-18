/**
 * Comprehensive test for SuperAdmin profile endpoint
 * Verifies:
 *  - SuperAdmin login → profile fetch succeeds
 *  - /api/auth/profile returns 200
 *  - firmId === null
 *  - isSuperAdmin === true
 *  - No DB access is attempted
 *  - No transaction is used
 */

const assert = require('assert');
const bcrypt = require('bcrypt');

const User = require('../src/models/User.model');
const UserProfile = require('../src/models/UserProfile.model');
const jwtService = require('../src/services/jwt.service');
const { getProfile } = require('../src/controllers/auth.controller');

async function shouldReturnSuperAdminProfile() {
  const plainPassword = 'S@fePassw0rd!';
  const hash = await bcrypt.hash(plainPassword, 10);

  process.env.SUPERADMIN_XID = 'SATEST';
  process.env.SUPERADMIN_EMAIL = 'sa@test.com';
  process.env.SUPERADMIN_PASSWORD_HASH = hash;
  process.env.JWT_SECRET = 'test-secret';

  // Track DB access - should NOT happen for SuperAdmin
  let userPopulateCalled = false;
  let userProfileLookupCalled = false;
  
  const originalUserFindOne = User.findOne;
  User.findOne = async () => {
    throw new Error('SuperAdmin profile should not query User collection');
  };
  
  const originalUserProfileFindOne = UserProfile.findOne;
  UserProfile.findOne = async () => {
    userProfileLookupCalled = true;
    throw new Error('SuperAdmin profile should not query UserProfile collection');
  };

  // Mock SuperAdmin user attached by authenticate middleware
  const superadminUser = {
    xID: 'SATEST',
    email: 'sa@test.com',
    role: 'SuperAdmin',
    _id: 'SUPERADMIN',
    isActive: true,
    firmId: null,
    defaultClientId: null,
    populate: function() {
      userPopulateCalled = true;
      throw new Error('SuperAdmin profile should not populate user');
    },
  };

  const resBody = {};
  const res = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (body) {
      Object.assign(resBody, body);
      return this;
    },
  };

  const req = {
    user: superadminUser,
    jwt: {
      userId: 'SUPERADMIN',
      role: 'SuperAdmin',
      firmId: null,
      firmSlug: null,
      defaultClientId: null,
      isSuperAdmin: true,
    },
    ip: '127.0.0.1',
    get: () => 'test-agent',
  };

  try {
    await getProfile(req, res);
  } finally {
    User.findOne = originalUserFindOne;
    UserProfile.findOne = originalUserProfileFindOne;
  }

  // Assertions
  assert.strictEqual(userPopulateCalled, false, 'SuperAdmin profile must not populate user');
  assert.strictEqual(userProfileLookupCalled, false, 'SuperAdmin profile must not query UserProfile');
  assert.strictEqual(resBody.success, true, 'Profile fetch should succeed');
  assert.strictEqual(res.statusCode, undefined, 'Should return 200 (no explicit status set)');
  
  const profile = resBody.data || {};
  assert.strictEqual(profile.id, 'superadmin', 'Profile id must be "superadmin"');
  assert.strictEqual(profile.xID, 'SATEST', 'Profile xID must match env');
  assert.strictEqual(profile.email, 'sa@test.com', 'Profile email must match env');
  assert.strictEqual(profile.role, 'SuperAdmin', 'Profile role must be SuperAdmin');
  assert.strictEqual(profile.firmId, null, 'Profile firmId must be null');
  assert.strictEqual(profile.firmSlug, null, 'Profile firmSlug must be null');
  assert.strictEqual(profile.defaultClientId, null, 'Profile defaultClientId must be null');
  assert.strictEqual(profile.isSuperAdmin, true, 'Profile must flag isSuperAdmin');
  assert.strictEqual(profile.refreshEnabled, false, 'Profile must show refreshEnabled: false');
  assert.deepStrictEqual(profile.permissions, ['*'], 'Profile must show all permissions');

  console.log('✓ SuperAdmin profile returns correct virtual profile without DB access');
}

async function shouldDetectSuperAdminFromMultipleSignals() {
  process.env.SUPERADMIN_XID = 'SATEST';
  process.env.SUPERADMIN_EMAIL = 'sa@test.com';
  process.env.JWT_SECRET = 'test-secret';

  const testCases = [
    {
      name: 'SuperAdmin role in user',
      user: { role: 'SuperAdmin', _id: 'SUPERADMIN', firmId: null },
      jwt: {},
    },
    {
      name: 'SUPERADMIN role in user',
      user: { role: 'SUPERADMIN', _id: 'SUPERADMIN', firmId: null },
      jwt: {},
    },
    {
      name: 'SUPER_ADMIN role in user',
      user: { role: 'SUPER_ADMIN', _id: 'SUPERADMIN', firmId: null },
      jwt: {},
    },
    {
      name: 'isSuperAdmin flag in JWT',
      user: { role: 'SuperAdmin', _id: 'SUPERADMIN' },
      jwt: { isSuperAdmin: true },
    },
    {
      name: 'SUPERADMIN role in JWT',
      user: { _id: 'SUPERADMIN' },
      jwt: { role: 'SUPERADMIN', isSuperAdmin: true },
    },
    {
      name: 'firmId null with SuperAdmin role',
      user: { role: 'SuperAdmin', _id: 'SUPERADMIN', firmId: null },
      jwt: { firmId: null },
    },
  ];

  for (const testCase of testCases) {
    const resBody = {};
    const res = {
      json: function (body) {
        Object.assign(resBody, body);
        return this;
      },
    };

    const req = {
      user: testCase.user,
      jwt: testCase.jwt,
      ip: '127.0.0.1',
      get: () => 'test-agent',
    };

    await getProfile(req, res);

    assert.strictEqual(
      resBody.success,
      true,
      `${testCase.name}: Should detect SuperAdmin and return virtual profile`
    );
    assert.strictEqual(
      resBody.data?.isSuperAdmin,
      true,
      `${testCase.name}: Profile must flag isSuperAdmin`
    );
    assert.strictEqual(
      resBody.data?.firmId,
      null,
      `${testCase.name}: Profile firmId must be null`
    );
  }

  console.log('✓ SuperAdmin detection works with all signal combinations');
}

async function shouldNotUseTransaction() {
  process.env.SUPERADMIN_XID = 'SATEST';
  process.env.SUPERADMIN_EMAIL = 'sa@test.com';
  process.env.JWT_SECRET = 'test-secret';

  const superadminUser = {
    xID: 'SATEST',
    email: 'sa@test.com',
    role: 'SuperAdmin',
    _id: 'SUPERADMIN',
    isActive: true,
    firmId: null,
    defaultClientId: null,
  };

  const resBody = {};
  const res = {
    json: function (body) {
      Object.assign(resBody, body);
      return this;
    },
  };

  // Mock request with transaction session (should not be used)
  let transactionUsed = false;
  const req = {
    user: superadminUser,
    jwt: {
      userId: 'SUPERADMIN',
      role: 'SuperAdmin',
      isSuperAdmin: true,
    },
    transactionSession: {
      session: {},
      withTransaction: async () => {
        transactionUsed = true;
        throw new Error('SuperAdmin profile should not use transactions');
      },
    },
    ip: '127.0.0.1',
    get: () => 'test-agent',
  };

  await getProfile(req, res);

  assert.strictEqual(transactionUsed, false, 'SuperAdmin profile must not use transactions');
  assert.strictEqual(resBody.success, true, 'Profile fetch should succeed without transaction');

  console.log('✓ SuperAdmin profile does not use transactions');
}

async function run() {
  try {
    await shouldReturnSuperAdminProfile();
    await shouldDetectSuperAdminFromMultipleSignals();
    await shouldNotUseTransaction();
    console.log('\n✅ All SuperAdmin profile tests passed.');
    process.exit(0);
  } catch (err) {
    console.error('✗ SuperAdmin profile test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();
