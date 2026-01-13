#!/usr/bin/env node
const assert = require('assert');
const EventEmitter = require('events');
const lifecycle = require('../src/middleware/requestLifecycle.middleware');
const log = require('../src/utils/log');
const { reset: resetQueue } = require('../src/services/sideEffectQueue.service');

class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = {};
  }

  setHeader(key, value) {
    this.headers[key] = value;
  }
}

async function testLifecycleLogsOnce() {
  resetQueue();
  const logs = [];
  const originalInfo = log.info;
  log.info = (event, meta) => logs.push({ event, meta });

  const req = {
    method: 'GET',
    originalUrl: '/test',
    user: { xID: 'X1', role: 'Admin' },
    firmId: 'FIRM123',
  };
  const res = new MockResponse();

  lifecycle(req, res, () => {});
  res.emit('finish');
  res.emit('close');

  log.info = originalInfo;

  const lifecycleLogs = logs.filter((l) => l.event === 'REQUEST_LIFECYCLE');
  assert.strictEqual(lifecycleLogs.length, 1, 'Lifecycle log should fire exactly once');
  assert.strictEqual(typeof res.headers['X-Request-ID'], 'string');
  assert.strictEqual(lifecycleLogs[0].meta.transactionCommitted, false);
}

async function run() {
  try {
    await testLifecycleLogsOnce();
    console.log('Request lifecycle tests passed.');
  } catch (err) {
    console.error('Request lifecycle tests failed:', err);
    process.exit(1);
  }
}

run();
