const assert = require('assert');

const { noFirmNoTransaction } = require('../src/middleware/noFirmNoTransaction.middleware');
const { adminAuditTrail } = require('../src/middleware/adminAudit.middleware');
const { addTenantContext } = require('../src/middleware/tenantScope.middleware');

const buildRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.payload = payload;
    return res;
  };
  return res;
};

const testNoFirmNoTransaction = () => {
  let nextCalled = false;
  const superadminReq = { user: { role: 'SuperAdmin' } };
  noFirmNoTransaction(superadminReq, {}, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true, 'SuperAdmin should bypass guard middleware');
  assert.strictEqual(superadminReq.skipFirmContext, undefined, 'SuperAdmin should not set skipFirmContext');
  assert.strictEqual(superadminReq.skipTransaction, undefined, 'SuperAdmin should not set skipTransaction');

  nextCalled = false;
  const adminReq = { user: { role: 'Admin' } };
  noFirmNoTransaction(adminReq, {}, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true, 'Non-SuperAdmin requests should continue');
  assert.strictEqual(adminReq.skipFirmContext, true, 'Non-SuperAdmin should skip firm context');
  assert.strictEqual(adminReq.skipTransaction, true, 'Non-SuperAdmin should skip transactions');
  console.log('✓ noFirmNoTransaction bypass semantics verified');
};

const testAdminAuditSemantics = () => {
  const middleware = adminAuditTrail('superadmin');

  let nextCalled = false;
  const missingActorReq = {
    method: 'POST',
    originalUrl: '/api/superadmin/firms',
    params: {},
  };
  const missingActorRes = buildRes();
  middleware(missingActorReq, missingActorRes, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, false, 'Audit should block when actor is missing');
  assert.strictEqual(missingActorRes.statusCode, 401, 'Missing actor should return 401');

  nextCalled = false;
  const missingFirmReq = {
    method: 'POST',
    originalUrl: '/api/superadmin/firms',
    params: {},
    user: { xID: 'XSA001' },
  };
  const missingFirmRes = buildRes();
  middleware(missingFirmReq, missingFirmRes, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, false, 'Audit should block when firm context is missing');
  assert.strictEqual(missingFirmRes.statusCode, 403, 'Missing firm context should return 403');
  assert.strictEqual(missingFirmRes.payload?.code, 'AUDIT_FIRM_CONTEXT_REQUIRED');
  console.log('✓ adminAuditTrail 401/403 semantics verified');
};

const testTenantScopeSemantics = () => {
  let nextCalled = false;
  const noUserReq = {};
  const noUserRes = buildRes();
  addTenantContext(noUserReq, noUserRes, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, false, 'Tenant scope should block when user missing');
  assert.strictEqual(noUserRes.statusCode, 401, 'Missing user should return 401');

  nextCalled = false;
  const noFirmReq = { user: { xID: 'XSA001' } };
  const noFirmRes = buildRes();
  addTenantContext(noFirmReq, noFirmRes, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, false, 'Tenant scope should block when firmId missing');
  assert.strictEqual(noFirmRes.statusCode, 403, 'Missing firmId should return 403');

  nextCalled = false;
  const validReq = { user: { xID: 'XSA001', firmId: 'FIRM001' } };
  const validRes = buildRes();
  addTenantContext(validReq, validRes, () => {
    nextCalled = true;
  });
  assert.strictEqual(nextCalled, true, 'Tenant scope should continue with firmId');
  assert.strictEqual(validReq.firmId, 'FIRM001', 'Tenant scope should attach firmId');
  console.log('✓ tenantScope 401/403 semantics verified');
};

const run = () => {
  try {
    testNoFirmNoTransaction();
    testAdminAuditSemantics();
    testTenantScopeSemantics();
    console.log('\nGuard semantics tests passed.');
  } catch (err) {
    console.error('Guard semantics tests failed:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
};

run();
