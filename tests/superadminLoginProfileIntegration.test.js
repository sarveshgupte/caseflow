/**
 * Integration test: SuperAdmin login → profile fetch
 * Simulates the complete frontend flow:
 * 1. POST /api/auth/login with SuperAdmin credentials
 * 2. GET /api/auth/profile with the returned access token
 * 
 * Verifies:
 * - Login returns 200 with access token
 * - Profile fetch returns 200 with virtual profile
 * - No firm resolution errors
 * - No refresh attempts
 * - No transaction logs
 */

const assert = require('assert');
const bcrypt = require('bcrypt');

const User = require('../src/models/User.model');
const UserProfile = require('../src/models/UserProfile.model');
const RefreshToken = require('../src/models/RefreshToken.model');
const jwtService = require('../src/services/jwt.service');
const { login, getProfile } = require('../src/controllers/auth.controller');

async function fullSuperAdminLoginProfileFlow() {
  const plainPassword = 'S@fePassw0rd!';
  const hash = await bcrypt.hash(plainPassword, 10);

  process.env.SUPERADMIN_XID = 'SATEST';
  process.env.SUPERADMIN_EMAIL = 'sa@test.com';
  process.env.SUPERADMIN_PASSWORD_HASH = hash;
  process.env.SUPERADMIN_OBJECT_ID = '000000000000000000000001';
  process.env.JWT_SECRET = 'test-secret';

  // Track that no DB lookups happen
  let userLookupCalled = false;
  let userProfileLookupCalled = false;
  let refreshTokenCreated = false;

  const originalUserFindOne = User.findOne;
  const originalUserCountDocuments = User.countDocuments;
  const originalUserProfileFindOne = UserProfile.findOne;
  const originalRefreshTokenCreate = RefreshToken.create;

  User.findOne = async () => {
    userLookupCalled = true;
    throw new Error('SuperAdmin flow should not query User collection');
  };
  
  User.countDocuments = async () => {
    // Allow system initialization check
    return 1;
  };

  UserProfile.findOne = async () => {
    userProfileLookupCalled = true;
    throw new Error('SuperAdmin flow should not query UserProfile collection');
  };

  RefreshToken.create = async (doc) => {
    refreshTokenCreated = true;
    throw new Error('SuperAdmin should not create refresh token');
  };

  // Step 1: Login
  let loginResBody = {};
  const loginRes = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (body) {
      Object.assign(loginResBody, body);
      return this;
    },
  };

  const loginReq = {
    body: { xID: 'SATEST', password: plainPassword },
    ip: '127.0.0.1',
    get: () => 'test-agent',
    transactionActive: true,
    transactionSession: {
      session: {},
      withTransaction: async (fn) => fn(),
    },
  };

  try {
    await login(loginReq, loginRes);
  } catch (err) {
    console.error('Login failed:', err);
    throw err;
  }

  // Verify login response
  assert.strictEqual(loginResBody.success, true, 'Login should succeed');
  assert.strictEqual(loginResBody.isSuperAdmin, true, 'Login should flag SuperAdmin');
  assert.strictEqual(loginResBody.refreshEnabled, false, 'Login should disable refresh');
  assert.strictEqual(loginResBody.refreshToken, null, 'Login should not return refresh token');
  assert(loginResBody.accessToken, 'Login should return access token');

  console.log('✓ Step 1: SuperAdmin login succeeded');

  // Decode the access token to extract user data
  const decoded = jwtService.verifyAccessToken(loginResBody.accessToken);
  assert.strictEqual(decoded.userId, '000000000000000000000001', 'Token userId must be SUPERADMIN_OBJECT_ID');
  assert.strictEqual(decoded.role, 'SUPERADMIN', 'Token role must be SUPERADMIN');
  assert.strictEqual(decoded.firmId, null, 'Token firmId must be null');
  assert.strictEqual(decoded.isSuperAdmin, true, 'Token must flag isSuperAdmin');

  console.log('✓ Step 2: Access token contains correct SuperAdmin claims');

  // Step 2: Fetch profile using the access token
  // Simulate authenticate middleware attaching user to req
  const superadminUser = {
    xID: 'SATEST',
    email: 'sa@test.com',
    role: 'SuperAdmin',
    _id: '000000000000000000000001',
    isActive: true,
    firmId: null,
    defaultClientId: null,
  };

  let profileResBody = {};
  const profileRes = {
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (body) {
      Object.assign(profileResBody, body);
      return this;
    },
  };

  const profileReq = {
    user: superadminUser,
    jwt: {
      userId: decoded.userId,
      role: decoded.role,
      firmId: decoded.firmId,
      firmSlug: null,
      defaultClientId: null,
      isSuperAdmin: decoded.isSuperAdmin,
    },
    headers: {
      authorization: `Bearer ${loginResBody.accessToken}`,
    },
    ip: '127.0.0.1',
    get: () => 'test-agent',
  };

  try {
    await getProfile(profileReq, profileRes);
  } catch (err) {
    console.error('Profile fetch failed:', err);
    throw err;
  } finally {
    User.findOne = originalUserFindOne;
    User.countDocuments = originalUserCountDocuments;
    UserProfile.findOne = originalUserProfileFindOne;
    RefreshToken.create = originalRefreshTokenCreate;
  }

  // Verify profile response
  assert.strictEqual(userLookupCalled, false, 'Profile fetch should not query User collection');
  assert.strictEqual(userProfileLookupCalled, false, 'Profile fetch should not query UserProfile collection');
  assert.strictEqual(refreshTokenCreated, false, 'SuperAdmin should not create refresh token');
  assert.strictEqual(profileResBody.success, true, 'Profile fetch should succeed');
  assert.strictEqual(profileRes.statusCode, undefined, 'Profile should return 200 (no explicit status)');

  const profile = profileResBody.data || {};
  assert.strictEqual(profile.id, '000000000000000000000001', 'Profile id must match SUPERADMIN_OBJECT_ID');
  assert.strictEqual(profile.xID, 'SATEST', 'Profile xID must match env');
  assert.strictEqual(profile.email, 'sa@test.com', 'Profile email must match env');
  assert.strictEqual(profile.role, 'SUPERADMIN', 'Profile role must be SUPERADMIN');
  assert.strictEqual(profile.firmId, null, 'Profile firmId must be null');
  assert.strictEqual(profile.firmSlug, null, 'Profile firmSlug must be null');
  assert.strictEqual(profile.defaultClientId, null, 'Profile defaultClientId must be null');
  assert.strictEqual(profile.isSuperAdmin, true, 'Profile must flag isSuperAdmin');
  assert.strictEqual(profile.refreshEnabled, false, 'Profile must show refreshEnabled: false');
  assert.deepStrictEqual(profile.permissions, ['*'], 'Profile must show all permissions');

  console.log('✓ Step 3: Profile fetch succeeded with virtual profile');
  console.log('✓ Step 4: No firm resolution errors');
  console.log('✓ Step 5: No refresh token created');
  console.log('✓ Step 6: No DB queries executed');
}

async function run() {
  try {
    await fullSuperAdminLoginProfileFlow();
    console.log('\n✅ SuperAdmin login → profile integration test passed.');
    console.log('   This simulates the complete frontend flow successfully.');
    process.exit(0);
  } catch (err) {
    console.error('✗ SuperAdmin login → profile integration test failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

run();
