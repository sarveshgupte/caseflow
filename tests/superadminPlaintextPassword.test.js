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

async function shouldPreferHashWhenAvailable() {
  const password = 'Candidate#123';
  const hash = await bcrypt.hash(password, 10);

  process.env.SUPERADMIN_PASSWORD_HASH = hash;
  process.env.SUPERADMIN_PASSWORD = 'plaintext-should-not-be-used';
  process.env.SUPERADMIN_XID = 'XHASH01';
  process.env.SUPERADMIN_EMAIL = 'sa@hash.test';
  process.env.JWT_SECRET = 'test-secret-hash-path';

  let compareCalledWith = null;
  const originalCompare = bcrypt.compare;
  bcrypt.compare = async (candidate, stored) => {
    compareCalledWith = { candidate, stored };
    return originalCompare(candidate, stored);
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
      { body: { xID: 'XHASH01', password }, ip: '127.0.0.1', get: () => 'agent' },
      res
    );
  } finally {
    bcrypt.compare = originalCompare;
    RefreshToken.create = originalRefreshCreate;
    jwtService.generateAccessToken = originalGenerateAccessToken;
    jwtService.generateRefreshToken = originalGenerateRefreshToken;
    jwtService.hashRefreshToken = originalHashRefreshToken;
  }

  assert.strictEqual(body.success, true, 'Hash-backed login should succeed');
  assert(compareCalledWith, 'bcrypt.compare must be invoked when hash is present');
  assert.strictEqual(compareCalledWith.stored, hash, 'Hash path must use SUPERADMIN_PASSWORD_HASH');
  assert.strictEqual(compareCalledWith.candidate, password, 'Hash path must compare provided password');
}

async function shouldAllowPlaintextWhenHashMissing() {
  const password = 'Plaintext#123';
  delete process.env.SUPERADMIN_PASSWORD_HASH;
  process.env.SUPERADMIN_PASSWORD = password;
  process.env.SUPERADMIN_XID = 'XPLAIN1';
  process.env.SUPERADMIN_EMAIL = 'sa@plain.test';
  process.env.JWT_SECRET = 'test-secret-plain-path';

  const originalCompare = bcrypt.compare;
  bcrypt.compare = async () => {
    throw new Error('bcrypt.compare should not be called when using plaintext fallback');
  };

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => {
    warnings.push(args.join(' '));
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
      { body: { xID: 'XPLAIN1', password }, ip: '127.0.0.1', get: () => 'agent' },
      res
    );
  } finally {
    bcrypt.compare = originalCompare;
    console.warn = originalWarn;
    RefreshToken.create = originalRefreshCreate;
    jwtService.generateAccessToken = originalGenerateAccessToken;
    jwtService.generateRefreshToken = originalGenerateRefreshToken;
    jwtService.hashRefreshToken = originalHashRefreshToken;
  }

  assert.strictEqual(body.success, true, 'Plaintext fallback should allow login when hash is missing');
  assert(
    warnings.some((w) => w.includes('[SECURITY] SuperAdmin authenticated using plaintext password')),
    'Plaintext login should emit security warning'
  );
}

function shouldFailValidationWhenNoSuperadminPassword() {
  delete process.env.SUPERADMIN_PASSWORD_HASH;
  delete process.env.SUPERADMIN_PASSWORD;
  process.env.JWT_SECRET = 'test-secret-env-check';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db';
  process.env.SUPERADMIN_XID = 'X999999';
  process.env.SUPERADMIN_EMAIL = 'sa@missing.test';
  process.env.DISABLE_GOOGLE_AUTH = 'true';

  const silentLogger = { error: () => {}, warn: () => {}, log: () => {} };
  const result = validateEnv({ exitOnError: false, logger: silentLogger });
  assert.strictEqual(result.valid, false, 'Env validation should fail when SuperAdmin credentials are missing');
  assert(
    result.errors.some((e) => e.field === 'SUPERADMIN_PASSWORD'),
    'Validation should report missing SuperAdmin credentials'
  );
}

async function run() {
  try {
    await shouldPreferHashWhenAvailable();
    await shouldAllowPlaintextWhenHashMissing();
    shouldFailValidationWhenNoSuperadminPassword();
    console.log('\nAll SuperAdmin plaintext password tests passed.');
  } catch (err) {
    console.error('SuperAdmin plaintext password tests failed:', err.message);
    process.exit(1);
  }
}

run();
