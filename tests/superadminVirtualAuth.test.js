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
      { body: { xID: 'SATEST', password: plainPassword }, ip: '127.0.0.1', get: () => 'test-agent' },
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

  assert(refreshCreatePayload, 'Refresh token should be persisted');
  assert.strictEqual(refreshCreatePayload.userId, null, 'SuperAdmin refresh token userId must be null');
  assert.strictEqual(refreshCreatePayload.firmId, null, 'SuperAdmin refresh token firmId must be null');

  console.log('✓ SuperAdmin login short-circuits DB and issues correct token payload');
}

async function shouldAllowPlaintextSuperadminLogin() {
  const plainPassword = 'PlainPass!234';
  delete process.env.SUPERADMIN_PASSWORD_HASH;
  process.env.SUPERADMIN_PASSWORD = plainPassword;
  process.env.SUPERADMIN_XID = 'SAPLAIN';
  process.env.SUPERADMIN_EMAIL = 'sa-plain@test.com';
  process.env.JWT_SECRET = 'test-secret';

  let bcryptUsed = false;
  const originalCompare = bcrypt.compare;
  bcrypt.compare = async () => {
    bcryptUsed = true;
    throw new Error('bcrypt.compare should not be called for plaintext superadmin auth');
  };

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (msg, ...rest) => {
    warnings.push(msg);
    return originalWarn.call(console, msg, ...rest);
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
      { body: { xID: 'SAPLAIN', password: plainPassword }, ip: '127.0.0.1', get: () => 'test-agent' },
      res
    );
  } finally {
    bcrypt.compare = originalCompare;
    console.warn = originalWarn;
    jwtService.generateAccessToken = originalGenerateAccessToken;
    jwtService.generateRefreshToken = originalGenerateRefreshToken;
    jwtService.hashRefreshToken = originalHashRefreshToken;
    RefreshToken.create = originalRefreshCreate;
  }

  assert.strictEqual(bcryptUsed, false, 'bcrypt.compare should not be used for plaintext superadmin auth');
  assert.strictEqual(resBody.success, true, 'Login should succeed with plaintext superadmin password');
  assert(warnings.includes('[SECURITY] SuperAdmin authenticated using plaintext password'), 'Should log plaintext security warning');

  const payload = tokenPayloads[0] || {};
  assert.strictEqual(payload.role, 'SUPERADMIN', 'Token role must be SUPERADMIN');
  assert.strictEqual(payload.isSuperAdmin, true, 'Token must carry isSuperAdmin: true');

  assert(refreshCreatePayload, 'Refresh token should be persisted');
  assert.strictEqual(refreshCreatePayload.userId, null, 'SuperAdmin refresh token userId must be null');
  assert.strictEqual(refreshCreatePayload.firmId, null, 'SuperAdmin refresh token firmId must be null');

  console.log('✓ SuperAdmin plaintext fallback authenticates with warning and without bcrypt');
}

async function run() {
  try {
    await shouldShortCircuitSuperadminLogin();
    await shouldAllowPlaintextSuperadminLogin();
    console.log('\nAll SuperAdmin virtual auth checks passed.');
  } catch (err) {
    console.error('✗ SuperAdmin virtual auth check failed:', err.message);
    process.exit(1);
  }
}

run();
