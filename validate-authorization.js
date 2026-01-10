#!/usr/bin/env node

/**
 * Authorization Policy Validation Script
 * 
 * This script validates that the authorization policies work as expected
 * by testing various user roles against different policies.
 */

const CasePolicy = require('./src/policies/case.policy');
const ClientPolicy = require('./src/policies/client.policy');
const AdminPolicy = require('./src/policies/admin.policy');
const SuperAdminPolicy = require('./src/policies/superadmin.policy');
const UserPolicy = require('./src/policies/user.policy');
const CategoryPolicy = require('./src/policies/category.policy');
const ReportsPolicy = require('./src/policies/reports.policy');
const FirmPolicy = require('./src/policies/firm.policy');

// Mock users
const adminUser = { role: 'Admin', xID: 'X000001', firmId: 'firm123' };
const employeeUser = { role: 'Employee', xID: 'X000002', firmId: 'firm123' };
const superAdminUser = { role: 'SuperAdmin', xID: 'SUPERADMIN' };

let passCount = 0;
let failCount = 0;

function test(description, expected, actual) {
  const passed = expected === actual;
  if (passed) {
    console.log(`✓ ${description}`);
    passCount++;
  } else {
    console.error(`✗ ${description}`);
    console.error(`  Expected: ${expected}, Got: ${actual}`);
    failCount++;
  }
}

console.log('\n=== Case Policy Tests ===');
test('Admin can view cases', true, CasePolicy.canView(adminUser));
test('Employee can view cases', true, CasePolicy.canView(employeeUser));
test('SuperAdmin cannot view cases (firm data)', false, CasePolicy.canView(superAdminUser));
test('Admin can create cases', true, CasePolicy.canCreate(adminUser));
test('Employee can create cases', true, CasePolicy.canCreate(employeeUser));
test('SuperAdmin cannot create cases', false, CasePolicy.canCreate(superAdminUser));
test('Admin can delete cases', true, CasePolicy.canDelete(adminUser));
test('Employee cannot delete cases', false, CasePolicy.canDelete(employeeUser));
test('Admin can assign cases', true, CasePolicy.canAssign(adminUser));
test('Employee cannot assign cases', false, CasePolicy.canAssign(employeeUser));

console.log('\n=== Client Policy Tests ===');
test('Admin can view clients', true, ClientPolicy.canView(adminUser));
test('Employee can view clients', true, ClientPolicy.canView(employeeUser));
test('SuperAdmin cannot view clients', false, ClientPolicy.canView(superAdminUser));
test('Admin can create clients', true, ClientPolicy.canCreate(adminUser));
test('Employee cannot create clients', false, ClientPolicy.canCreate(employeeUser));
test('Admin can update clients', true, ClientPolicy.canUpdate(adminUser));
test('Employee cannot update clients', false, ClientPolicy.canUpdate(employeeUser));

console.log('\n=== Admin Policy Tests ===');
test('Admin has admin access', true, AdminPolicy.isAdmin(adminUser));
test('Employee does not have admin access', false, AdminPolicy.isAdmin(employeeUser));
test('SuperAdmin does not have firm admin access', false, AdminPolicy.isAdmin(superAdminUser));
test('Admin can view stats', true, AdminPolicy.canViewStats(adminUser));
test('Admin can manage users', true, AdminPolicy.canManageUsers(adminUser));
test('Employee cannot manage users', false, AdminPolicy.canManageUsers(employeeUser));

console.log('\n=== SuperAdmin Policy Tests ===');
test('SuperAdmin has platform access', true, SuperAdminPolicy.isSuperAdmin(superAdminUser));
test('Admin is not SuperAdmin', false, SuperAdminPolicy.isSuperAdmin(adminUser));
test('SuperAdmin can manage firms', true, SuperAdminPolicy.canManageFirms(superAdminUser));
test('Admin cannot manage firms', false, SuperAdminPolicy.canManageFirms(adminUser));
test('Admin can access firm data', true, SuperAdminPolicy.cannotAccessFirmData(adminUser));
test('SuperAdmin cannot access firm data', false, SuperAdminPolicy.cannotAccessFirmData(superAdminUser));

console.log('\n=== User Policy Tests ===');
test('Admin can create users', true, UserPolicy.canCreate(adminUser));
test('Employee cannot create users', false, UserPolicy.canCreate(employeeUser));
test('Admin can delete users', true, UserPolicy.canDelete(adminUser));
test('Employee cannot delete users', false, UserPolicy.canDelete(employeeUser));

console.log('\n=== Category Policy Tests ===');
test('Admin can create categories', true, CategoryPolicy.canCreate(adminUser));
test('Employee cannot create categories', false, CategoryPolicy.canCreate(employeeUser));
test('Both can view categories', true, CategoryPolicy.canView(adminUser) && CategoryPolicy.canView(employeeUser));

console.log('\n=== Reports Policy Tests ===');
test('Admin can generate reports', true, ReportsPolicy.canGenerate(adminUser));
test('Employee can generate reports', true, ReportsPolicy.canGenerate(employeeUser));
test('SuperAdmin cannot generate firm reports', false, ReportsPolicy.canGenerate(superAdminUser));

console.log('\n=== Firm Policy Tests ===');
test('SuperAdmin can create firms', true, FirmPolicy.canCreate(superAdminUser));
test('Admin cannot create firms', false, FirmPolicy.canCreate(adminUser));
test('SuperAdmin can view firms', true, FirmPolicy.canView(superAdminUser));
test('Admin cannot view firm list', false, FirmPolicy.canView(adminUser));

console.log('\n=== Edge Case Tests ===');
test('Null user denied case access', false, CasePolicy.canView(null));
test('Undefined user denied case access', false, CasePolicy.canView(undefined));
test('User without role denied', false, CasePolicy.canView({ xID: 'X999999' }));

console.log('\n=== Test Summary ===');
console.log(`Total: ${passCount + failCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);

if (failCount === 0) {
  console.log('\n✓ All tests passed! Authorization policies working correctly.');
  process.exit(0);
} else {
  console.error(`\n✗ ${failCount} test(s) failed. Please review the policy logic.`);
  process.exit(1);
}
