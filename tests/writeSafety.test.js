#!/usr/bin/env node
const assert = require('assert');
const { idempotencyMiddleware, resetIdempotencyCache } = require('../src/middleware/idempotency.middleware');
const domainInvariantGuard = require('../src/middleware/domainInvariantGuard');
const { executeWrite } = require('../src/utils/executeWrite');

const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      if (this.statusCode == null) {
        this.statusCode = 200;
      }
      return this;
    },
    set(key, value) {
      this.headers[key] = value;
      return this;
    },
  };
  return res;
};

const runMiddleware = (middleware, req, res) => new Promise((resolve, reject) => {
  middleware(req, res, (err) => {
    if (err) {
      reject(err);
    } else {
      resolve();
    }
  });
});

const buildRequest = (overrides = {}) => {
  const headers = { 'Idempotency-Key': 'k', ...(overrides.headers || {}) };
  const req = {
    method: 'POST',
    originalUrl: '/api/cases',
    body: { title: 'A' },
    firmId: 'FIRM001',
    user: { _id: 'u1' },
    headers,
    get: (key) => {
      if (typeof key === 'string' && key.toLowerCase() === 'idempotency-key') {
        return headers['Idempotency-Key'] || headers['idempotency-key'];
      }
      return undefined;
    },
    ...overrides,
  };
  return req;
};

async function testIdempotentReplay() {
  resetIdempotencyCache();
  let handlerInvocations = 0;
  const reqA = buildRequest({ headers: { 'Idempotency-Key': 'k1' } });
  const resA = createMockRes();
  await runMiddleware(idempotencyMiddleware, reqA, resA);
  handlerInvocations += 1;
  resA.json({ ok: true });

  const reqB = buildRequest({ headers: { 'Idempotency-Key': 'k1' } });
  const resB = createMockRes();
  await runMiddleware(idempotencyMiddleware, reqB, resB);

  assert.strictEqual(handlerInvocations, 1, 'Handler should not re-run on replay');
  assert.strictEqual(resB.headers['Idempotent-Replay'], 'true');
  assert.strictEqual(resB.body.ok, true);
}

async function testConcurrentFingerprintConflict() {
  resetIdempotencyCache();
  const reqA = buildRequest({ headers: { 'Idempotency-Key': 'k2' }, body: { title: 'A' } });
  const resA = createMockRes();
  await runMiddleware(idempotencyMiddleware, reqA, resA);
  resA.json({ ok: true });

  const reqB = buildRequest({ headers: { 'Idempotency-Key': 'k2' }, body: { title: 'B' } });
  const resB = createMockRes();
  await runMiddleware(idempotencyMiddleware, reqB, resB);
  assert.strictEqual(resB.statusCode, 409, 'Conflicting fingerprint should be rejected');
}

async function testRetryAfterDelay() {
  resetIdempotencyCache();
  const req = buildRequest({ method: 'PATCH', originalUrl: '/api/clients/1', body: { name: 'X' }, headers: { 'Idempotency-Key': 'k3' } });
  const res = createMockRes();
  await runMiddleware(idempotencyMiddleware, req, res);
  await new Promise((resolve) => setTimeout(resolve, 10));
  res.json({ ok: true });

  const resRetry = createMockRes();
  await runMiddleware(idempotencyMiddleware, req, resRetry);
  assert.strictEqual(resRetry.body.ok, true);
}

async function testCrossFirmGuard() {
  const req = { method: 'POST', firmId: 'FIRM001', body: { firmId: 'FIRM002' } };
  const res = createMockRes();
  await runMiddleware(domainInvariantGuard, req, res);
  assert.strictEqual(res.statusCode, 403);
  assert.strictEqual(res.body.error, 'cross_firm_access_denied');
}

async function testInvalidStateGuard() {
  const req = { method: 'PATCH', body: { previousStatus: 'CLOSED', status: 'IN_PROGRESS' } };
  const res = createMockRes();
  await runMiddleware(domainInvariantGuard, req, res);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body.error, 'invalid_state_transition');
}

async function testExecuteWriteEnforcesTransaction() {
  let threw = false;
  try {
    await executeWrite({ req: {}, fn: async () => {} });
  } catch (err) {
    threw = true;
  }
  assert.strictEqual(threw, true, 'executeWrite should throw without transaction');

  const req = {
    transactionActive: true,
    transactionSession: {
      withTransaction: (fn) => fn(),
    },
  };
  const result = await executeWrite({ req, fn: async () => 'ok' });
  assert.strictEqual(result, 'ok');
}

async function run() {
  try {
    await testIdempotentReplay();
    await testConcurrentFingerprintConflict();
    await testRetryAfterDelay();
    await testCrossFirmGuard();
    await testInvalidStateGuard();
    await testExecuteWriteEnforcesTransaction();
    console.log('Write safety tests passed.');
  } catch (err) {
    console.error('Write safety tests failed:', err);
    process.exit(1);
  }
}

run();
