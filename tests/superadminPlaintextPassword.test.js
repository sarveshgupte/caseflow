const assert = require('assert');
const bcrypt = require('bcrypt');

const { login } = require('../src/controllers/auth.controller');
const RefreshToken = require('../src/models/RefreshToken.model');
const jwtService = require('../src/services/jwt.service');
const { validateEnv } = require('../src/config/validateEnv');

const createMockRes = () => {
  const body = {};
  const res = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      Object.assign(body, payload);
      return this;
    },
  };
  return { res, body };
};

const createTxnReq = (body) => ({
  body,
  ip: '127.0.0.1',
  get: () => 'agent',
  transactionActive: true,
  transactionSession: {
    session: {},
    withTransaction: async (fn) => fn(),
  },
});

async function shouldPreferPlaintextWhenProvided() {
  const plaintextPassword = 'Plaintext#789';
  const hash = await bcrypt.hash('Different#123', 10);

  process.env.SUPERADMIN_PASSWORD_HASH = hash;
  process.env.SUPERADMIN_PASSWORD = plaintextPassword;
  process.env.SUPERADMIN_XID = 'XHASH01';
  process.env.SUPERADMIN_EMAIL = 'sa@hash.test';
  process.env.JWT_SECRET = 'test-secret-hash-path';

  let compareCalled = false;
  const originalCompare = bcrypt.compare;
  bcrypt.compare = async () => {
    compareCalled = true;
    return false;
  };

  const originalRefreshCreate = RefreshToken.create;
  RefreshToken.create = async () => ({});

  const originalGenerateAccessToken = jwtService.generateAccessToken;
  const originalGenerateRefreshToken = jwtService.generateRefreshToken;
  const originalHashRefreshToken = jwtService.hashRefreshToken;
  jwtService.generateAccessToken = () => 'access-token';
  jwtService.generateRefreshToken = () => 'refresh-token';
  jwtService.hashRefreshToken = () => 'hashed-refresh-token';

  const { res, body } = createMockRes();

  try {
    await login(
      createTxnReq({ xID: 'XHASH01', password: plaintextPassword }),
      res
    );
  } finally {
    bcrypt.compare = originalCompare;
    RefreshToken.create = originalRefreshCreate;
    jwtService.generateAccessToken = originalGenerateAccessToken;
    jwtService.generateRefreshToken = originalGenerateRefreshToken;
    jwtService.hashRefreshToken = originalHashRefreshToken;
  }

  assert.strictEqual(body.success, true, 'Plaintext-backed login should succeed when SUPERADMIN_PASSWORD is set');
  assert.strictEqual(compareCalled, false, 'bcrypt.compare must be bypassed when SUPERADMIN_PASSWORD is provided');
}

async function shouldReturn401WhenHashMismatch() {
  const correctPassword = 'Plaintext#123';
  const wrongPassword = 'Wrong#123';
  delete process.env.SUPERADMIN_PASSWORD;
  process.env.SUPERADMIN_PASSWORD_HASH = await bcrypt.hash(correctPassword, 10);
  process.env.SUPERADMIN_XID = 'XPLAIN1';
  process.env.SUPERADMIN_EMAIL = 'sa@plain.test';
  process.env.JWT_SECRET = 'test-secret-plain-path';

  const originalCompare = bcrypt.compare;
  let compareCalled = false;
  bcrypt.compare = async (candidate, stored) => {
    compareCalled = true;
    return originalCompare(candidate, stored);
  };

  const originalRefreshCreate = RefreshToken.create;
  RefreshToken.create = async () => ({});

  const { res, body } = createMockRes();

  try {
    await login(
      createTxnReq({ xID: 'XPLAIN1', password: wrongPassword }),
      res
    );
  } finally {
    bcrypt.compare = originalCompare;
    RefreshToken.create = originalRefreshCreate;
  }

  assert.strictEqual(res.statusCode, 401, 'Invalid password should return 401');
  assert.strictEqual(body.success, false, 'Response should indicate failure on invalid credentials');
  assert(compareCalled, 'bcrypt.compare must be used for superadmin login');
}

function shouldFailValidationWhenNoSuperadminPassword() {
  delete process.env.SUPERADMIN_PASSWORD;
  delete process.env.SUPERADMIN_PASSWORD_HASH;
  process.env.JWT_SECRET = 'test-secret-env-check';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db';
  process.env.SUPERADMIN_XID = 'X999999';
  process.env.SUPERADMIN_EMAIL = 'sa@missing.test';
  process.env.DISABLE_GOOGLE_AUTH = 'true';

  const silentLogger = { error: () => {}, warn: () => {}, log: () => {} };
  const result = validateEnv({ exitOnError: false, logger: silentLogger });
  assert.strictEqual(result.valid, false, 'Env validation should fail when SuperAdmin credentials are missing');
  assert(
    result.errors.some((e) => e.field === 'SUPERADMIN_PASSWORD_HASH'),
    'Validation should report missing SuperAdmin hash'
  );
}

function shouldPassValidationWithPlaintextPassword() {
  process.env.SUPERADMIN_PASSWORD = 'Bootstrap#123';
  delete process.env.SUPERADMIN_PASSWORD_HASH;
  process.env.JWT_SECRET = 'test-secret-env-check-2';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db';
  process.env.SUPERADMIN_XID = 'X111111';
  process.env.SUPERADMIN_EMAIL = 'sa@plaintext.test';
  process.env.DISABLE_GOOGLE_AUTH = 'true';

  const silentLogger = { error: () => {}, warn: () => {}, log: () => {} };
  const result = validateEnv({ exitOnError: false, logger: silentLogger });
  assert.strictEqual(result.valid, true, 'Env validation should pass when SUPERADMIN_PASSWORD is provided');
}

async function run() {
  try {
    await shouldPreferPlaintextWhenProvided();
    await shouldReturn401WhenHashMismatch();
    shouldFailValidationWhenNoSuperadminPassword();
    shouldPassValidationWithPlaintextPassword();
    console.log('\nAll SuperAdmin bcrypt authentication tests passed.');
  } catch (err) {
    console.error('SuperAdmin plaintext password tests failed:', err.message);
    process.exit(1);
  }
}

run();
