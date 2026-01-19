#!/usr/bin/env node
const assert = require('assert');
const sideEffects = require('../src/services/sideEffectQueue.service');
const plugin = require('../src/utils/softDelete.plugin.js');

const reloadSoftDelete = () => {
  delete require.cache[require.resolve('../src/services/softDelete.service')];
  return require('../src/services/softDelete.service');
};

const buildStubQuery = (doc) => ({
  session() {
    return this;
  },
  includeDeleted() {
    return this;
  },
  async exec() {
    return doc;
  },
});

const buildStubModel = (doc) => ({
  modelName: 'Task',
  findOne: () => buildStubQuery(doc),
});

async function testSoftDeleteIdempotent() {
  const { softDelete } = reloadSoftDelete();
  const doc = {
    deletedAt: null,
    deletedByXID: null,
    deleteReason: null,
    save: async function save() {
      return this;
    },
  };
  const model = buildStubModel(doc);
  const req = { user: { xID: 'X123456' } };

  await softDelete({ model, filter: {}, req, reason: 'test-reason' });
  assert.ok(doc.deletedAt instanceof Date, 'deletedAt should be set');
  assert.strictEqual(doc.deletedByXID, 'X123456');
  assert.strictEqual(doc.deleteReason, 'test-reason');

  // Second delete should be idempotent
  await softDelete({ model, filter: {}, req, reason: 'ignored' });
  assert.strictEqual(doc.deleteReason, 'test-reason', 'reason should not be overwritten on double delete');
}

async function testRestore() {
  const { restoreDocument } = reloadSoftDelete();
  const deletedAt = new Date(Date.now() - 1000);
  const doc = {
    deletedAt,
    deletedByXID: 'X000001',
    deleteReason: 'cleanup',
    restoreHistory: [],
    save: async function save() {
      return this;
    },
  };
  const model = buildStubModel(doc);
  const req = { user: { xID: 'X999999' } };

  await restoreDocument({ model, filter: {}, req });
  assert.strictEqual(doc.deletedAt, null, 'deletedAt should be cleared on restore');
  assert.strictEqual(doc.deletedByXID, null, 'deletedByXID should be cleared on restore');
  assert.strictEqual(doc.deleteReason, null, 'deleteReason should be cleared on restore');
  assert.strictEqual(doc.restoreHistory.length, 1, 'restoreHistory should capture restore');
  assert.strictEqual(doc.restoreHistory[0].restoredByXID, 'X999999');
}

async function testUserDeleteRestorePreservesAuthState() {
  const { softDelete, restoreDocument } = reloadSoftDelete();
  const original = {
    deletedAt: null,
    status: 'INVITED',
    isActive: false,
    lockUntil: new Date(Date.now() + 60_000),
    save: async function save() { return this; },
  };
  const model = {
    modelName: 'User',
    findOne: () => ({
      session() { return this; },
      includeDeleted() { return this; },
      async exec() { return original; },
    }),
  };
  const req = { user: { xID: 'X111111' } };
  await softDelete({ model, filter: {}, req, reason: 'cleanup' });
  const snapshot = original.deletedAuthSnapshot;
  assert.deepStrictEqual(
    snapshot,
    { status: 'INVITED', isActive: false, lockUntil: original.lockUntil },
    'Auth snapshot should capture original state'
  );
  assert.strictEqual(original.status, 'DISABLED');
  assert.strictEqual(original.isActive, false);

  await restoreDocument({ model, filter: {}, req });
  assert.strictEqual(original.status, 'INVITED');
  assert.strictEqual(original.isActive, false);
  assert.strictEqual(original.lockUntil.getTime(), snapshot.lockUntil.getTime());
  assert.strictEqual(original.deletedAuthSnapshot, undefined);
}

async function testAuditNotWrittenOnRollback() {
  const originalEnqueue = sideEffects.enqueueAfterCommit;
  const captured = [];
  sideEffects.enqueueAfterCommit = (req, effect) => {
    effect.execute = async () => { effect._executed = true; };
    if (!req._pendingSideEffects) req._pendingSideEffects = [];
    req._pendingSideEffects.push(effect);
    captured.push(effect);
    return 'id';
  };
  delete require.cache[require.resolve('../src/services/softDelete.service')];
  const { softDelete } = require('../src/services/softDelete.service');

  let executed = false;
  const doc = {
    deletedAt: null,
    save: async function save() { return this; },
  };
  const model = {
    modelName: 'Task',
    findOne: () => ({
      session() { return this; },
      includeDeleted() { return this; },
      async exec() { return doc; },
    }),
  };
  const req = { transactionActive: true, transactionCommitted: false };
  await softDelete({ model, filter: {}, req, reason: 'rollback' });
  assert.ok(captured.length > 0, 'Audit effect should be enqueued');
  await sideEffects.flushRequestEffects(req);
  await new Promise(r => setTimeout(r, 10));
  assert.strictEqual(captured.some((e) => e._executed), false, 'Audit should not run on rollback');

  sideEffects.enqueueAfterCommit = originalEnqueue;
}

async function testManualDeletedAtGuard() {
  const { applyDefaultDeletedFilter } = plugin._test;
  assert.throws(
    () => applyDefaultDeletedFilter({ deletedAt: { $ne: null } }),
    /Manual deletedAt filters are forbidden/,
    'Manual deletedAt filter should throw'
  );
  assert.doesNotThrow(() => applyDefaultDeletedFilter({ deletedAt: { $ne: null }, includeDeleted: true }));
}

function testCountDocumentsHookFallback() {
  const hooks = {};
  const schema = {
    add() {},
    pre(name, handler) {
      if (name === 'countDocuments') {
        hooks.countDocuments = handler;
      }
    },
    query: {},
  };
  plugin(schema);
  let setQueryArgs;
  const query = {
    getFilter: () => ({}),
    setQuery: (value) => {
      setQueryArgs = value;
    },
  };
  hooks.countDocuments.call(query);
  assert.deepStrictEqual(setQueryArgs, { deletedAt: null }, 'countDocuments hook should update query filter safely');
}

async function run() {
  await testSoftDeleteIdempotent();
  await testRestore();
  await testUserDeleteRestorePreservesAuthState();
  await testAuditNotWrittenOnRollback();
  await testManualDeletedAtGuard();
  testCountDocumentsHookFallback();
  console.log('Soft delete service tests passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
