/**
 * Focused regression test for ENV-backed SuperAdmin authentication.
 * Verifies:
 *  - MongoDB lookups are bypassed for SuperAdmin login
 *  - Access token payload includes firmId: null and isSuperAdmin: true
 */

const assert = require('assert');
const bcrypt = require('bcrypt');

const User = require('../src/models/User.model');
const RefreshToken = require('../src/models/RefreshToken.model');
const jwtService = require('../src/services/jwt.service');
const { login } = require('../src/controllers/auth.controller');

async function shouldShortCircuitSuperadminLogin() {
  const plainPassword = 'S@fePassw0rd!';
  const hash = await bcrypt.hash(plainPassword, 10);

  process.env.SUPERADMIN_XID = 'SATEST';
  process.env.SUPERADMIN_EMAIL = 'sa@test.com';
  process.env.SUPERADMIN_PASSWORD_HASH = hash;
  process.env.SUPERADMIN_OBJECT_ID = '000000000000000000000001';
  process.env.JWT_SECRET = 'test-secret';

  let userLookupCalled = false;
  const originalFindOne = User.findOne;
  User.findOne = async () => {
    userLookupCalled = true;
    throw new Error('SuperAdmin path should not query MongoDB');
  };

  const tokenPayloads = [];
  const originalGenerateAccessToken = jwtService.generateAccessToken;
  jwtService.generateAccessToken = (payload) => {
    tokenPayloads.push(payload);
    return 'access-token';
  };

  const originalGenerateRefreshToken = jwtService.generateRefreshToken;
  const originalHashRefreshToken = jwtService.hashRefreshToken;
  jwtService.generateRefreshToken = () => 'refresh-token';
  jwtService.hashRefreshToken = () => 'hashed-refresh-token';

  let refreshCreatePayload = null;
  const originalRefreshCreate = RefreshToken.create;
  RefreshToken.create = async (doc) => {
    refreshCreatePayload = doc;
    return doc;
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

  try {
    await login(
      {
        body: { xID: 'SATEST', password: plainPassword },
        ip: '127.0.0.1',
        get: () => 'test-agent',
        transactionActive: true,
        transactionSession: {
          session: {},
          withTransaction: async (fn) => fn(),
        },
      },
      res
    );
  } finally {
    User.findOne = originalFindOne;
    jwtService.generateAccessToken = originalGenerateAccessToken;
    jwtService.generateRefreshToken = originalGenerateRefreshToken;
    jwtService.hashRefreshToken = originalHashRefreshToken;
    RefreshToken.create = originalRefreshCreate;
  }

  assert.strictEqual(userLookupCalled, false, 'SuperAdmin login must bypass MongoDB lookups');
  assert.strictEqual(resBody.success, true, 'Login should succeed');

  const payload = tokenPayloads[0] || {};
  assert.strictEqual(payload.role, 'SUPERADMIN', 'Token role must be SUPERADMIN');
  assert.strictEqual(payload.firmId, null, 'Token must carry firmId: null');
  assert.strictEqual(payload.isSuperAdmin, true, 'Token must carry isSuperAdmin: true');

  assert.strictEqual(resBody.isSuperAdmin, true, 'Login response must flag SuperAdmin');
  assert.strictEqual(resBody.refreshEnabled, false, 'SuperAdmin login must disable refresh');
  assert.strictEqual(resBody.refreshToken, null, 'SuperAdmin login should not return refresh token');
  assert.strictEqual(refreshCreatePayload, null, 'SuperAdmin refresh token should not be persisted');

  console.log('✓ SuperAdmin login short-circuits DB and issues correct token payload');
}

async function run() {
  try {
    await shouldShortCircuitSuperadminLogin();
    console.log('\nAll SuperAdmin virtual auth checks passed.');
  } catch (err) {
    console.error('✗ SuperAdmin virtual auth check failed:', err.message);
    process.exit(1);
  }
}

run();
