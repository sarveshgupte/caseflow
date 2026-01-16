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
      if (typeof key !== 'string') return undefined;
      const normalized = key.toLowerCase();
      const direct = headers[key] ?? headers[normalized];
      if (direct !== undefined) return direct;
      if (normalized === 'idempotency-key') {
        return headers['Idempotency-Key'] ?? headers['idempotency-key'];
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
  reqA.transactionCommitted = true;
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
  reqA.transactionCommitted = true;
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
  req.transactionCommitted = true;
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

  const skipReq = { skipTransaction: true };
  const skipResult = await executeWrite({ req: skipReq, fn: async () => 'skip' });
  assert.strictEqual(skipResult, 'skip');
  assert.strictEqual(skipReq.transactionSkipped, true, 'Skip transactions should mark skipped for idempotency');

  const req = {
    transactionActive: true,
    transactionSession: {
      withTransaction: (fn) => fn(),
    },
  };
  const result = await executeWrite({ req, fn: async () => 'ok' });
  assert.strictEqual(result, 'ok');
}

async function testIdempotencySkipsCacheOnRollback() {
  resetIdempotencyCache();
  let handlerRuns = 0;

  const makeReq = (opts = {}) => buildRequest({
    headers: { 'Idempotency-Key': 'k4' },
    transactionActive: true,
    transactionSession: opts.transactionSession,
    transactionCommitted: false,
  });

  const failingReq = makeReq({
    transactionSession: {
      withTransaction: async (fn) => {
        const result = await fn('session');
        throw new Error('fail-before-commit');
      },
    },
  });
  const res1 = createMockRes();
  await runMiddleware(idempotencyMiddleware, failingReq, res1);
  try {
    await executeWrite({
      req: failingReq,
      fn: async () => {
        handlerRuns += 1;
        res1.json({ ok: true });
        throw new Error('fail-after-json');
      },
    });
  } catch (err) {
    // expected
  }
  assert.strictEqual(failingReq.transactionCommitted, false, 'Commit flag should remain false on rollback');

  const successReq = makeReq({
    transactionSession: {
      withTransaction: async (fn) => fn('session'),
    },
  });
  const res2 = createMockRes();
  await runMiddleware(idempotencyMiddleware, successReq, res2);
  await executeWrite({
    req: successReq,
    fn: async () => {
      handlerRuns += 1;
      res2.json({ ok: true });
    },
  });

  assert.strictEqual(handlerRuns, 2, 'Handler should run again after rollback');
  assert.strictEqual(res2.headers['Idempotent-Replay'], undefined, 'Replay header should not be set after rollback');
  assert.strictEqual(successReq.transactionCommitted, true, 'Commit flag should be true after successful transaction');
}

async function testControllerGuardWithoutTransaction() {
  const { createUser } = require('../src/controllers/userController');
  const req = { transactionActive: false };
  const res = {};
  let threw = false;

  try {
    await createUser(req, res);
  } catch (err) {
    threw = true;
    assert.strictEqual(err.statusCode, 500);
    assert.match(err.message, /transaction/i);
  }

  assert.strictEqual(threw, true, 'Mutating controller should throw when no transaction is active');
}

async function run() {
  try {
    await testIdempotentReplay();
    await testConcurrentFingerprintConflict();
    await testRetryAfterDelay();
    await testCrossFirmGuard();
    await testInvalidStateGuard();
    await testExecuteWriteEnforcesTransaction();
    await testIdempotencySkipsCacheOnRollback();
    await testControllerGuardWithoutTransaction();
    console.log('Write safety tests passed.');
  } catch (err) {
    console.error('Write safety tests failed:', err);
    process.exit(1);
  }
}

run();
