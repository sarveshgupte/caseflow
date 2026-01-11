#!/usr/bin/env node
/**
 * Targeted regression checks:
 * 1) SUPERADMIN logout must not perform ObjectId-based DB writes
 * 2) Bootstrap must allow an empty database without throwing
 */

const assert = require('assert');
const authController = require('./src/controllers/auth.controller');
const RefreshToken = require('./src/models/RefreshToken.model');
const AuthAudit = require('./src/models/AuthAudit.model');
const Firm = require('./src/models/Firm.model');
const bootstrapService = require('./src/services/bootstrap.service');

async function testSuperadminLogoutBypassesDbWrites() {
  let refreshCalled = false;
  let auditCalled = false;

  const originalUpdateMany = RefreshToken.updateMany;
  const originalAuditCreate = AuthAudit.create;

  RefreshToken.updateMany = async () => {
    refreshCalled = true;
  };

  AuthAudit.create = async () => {
    auditCalled = true;
  };

  const clearedCookies = [];
  const res = {
    clearCookie: (name) => clearedCookies.push(name),
    json: (body) => {
      res.body = body;
    },
  };

  const req = {
    user: { _id: 'SUPERADMIN', role: 'SuperAdmin', xID: 'SUPERADMIN' },
    ip: '127.0.0.1',
    get: () => 'test-agent',
  };

  try {
    await authController.logout(req, res);
  } finally {
    RefreshToken.updateMany = originalUpdateMany;
    AuthAudit.create = originalAuditCreate;
  }

  assert.strictEqual(refreshCalled, false, 'SuperAdmin logout should skip token revocation');
  assert.strictEqual(auditCalled, false, 'SuperAdmin logout should skip audit write');
  assert.strictEqual(res.body?.success, true, 'Logout should respond with success');
  assert(clearedCookies.includes('accessToken'), 'Access token cookie should be cleared');
  assert(clearedCookies.includes('refreshToken'), 'Refresh token cookie should be cleared');

  console.log('✓ SUPERADMIN logout bypasses userId-based DB writes');
}

async function testBootstrapAllowsEmptyDatabase() {
  const originalCount = Firm.countDocuments;
  let countCalled = false;

  Firm.countDocuments = async () => {
    countCalled = true;
    return 0;
  };

  try {
    await bootstrapService.runBootstrap();
  } finally {
    Firm.countDocuments = originalCount;
  }

  assert.strictEqual(countCalled, true, 'Preflight should check firm count');
  console.log('✓ Bootstrap permits empty database without errors');
}

async function run() {
  try {
    await testSuperadminLogoutBypassesDbWrites();
    await testBootstrapAllowsEmptyDatabase();
    console.log('\nAll targeted regression checks passed.');
  } catch (error) {
    console.error('✗ Regression check failed:', error.message);
    process.exit(1);
  }
}

run();
