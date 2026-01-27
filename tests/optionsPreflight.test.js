#!/usr/bin/env node
const assert = require('assert');
const optionsPreflight = require('../src/middleware/optionsPreflight.middleware');
const { authenticate } = require('../src/middleware/auth.middleware');

const createRes = () => ({
  headers: {},
  statusCode: null,
  header(key, value) {
    this.headers[key] = value;
  },
  sendStatus(code) {
    this.statusCode = code;
    return this;
  },
});

async function testOptionsReturns204() {
  const req = { method: 'OPTIONS', headers: { origin: 'https://example.com' } };
  const res = createRes();
  let nextCalled = false;
  optionsPreflight(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, false, 'OPTIONS should be handled immediately');
  assert.strictEqual(res.statusCode, 204);
  assert.strictEqual(res.headers['Access-Control-Allow-Origin'], 'https://example.com');
  assert.strictEqual(res.headers['Access-Control-Allow-Credentials'], 'true');
  assert.ok(res.headers['Access-Control-Allow-Headers'].includes('Authorization'));
  assert.ok(res.headers['Access-Control-Allow-Methods'].includes('OPTIONS'));
}

async function testOptionsFallsThrough() {
  const req = { method: 'GET', headers: {} };
  const res = createRes();
  let nextCalled = false;
  optionsPreflight(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'Non-OPTIONS should pass through');
  assert.strictEqual(res.statusCode, null);
}

async function testAuthSkipsOptions() {
  const req = { method: 'OPTIONS' };
  const res = {};
  let nextCalled = false;
  await authenticate(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'Auth should skip OPTIONS');
}

async function run() {
  try {
    await testOptionsReturns204();
    await testOptionsFallsThrough();
    await testAuthSkipsOptions();
    console.log('OPTIONS preflight tests passed.');
  } catch (err) {
    console.error('OPTIONS preflight tests failed:', err);
    process.exit(1);
  }
}

run();
