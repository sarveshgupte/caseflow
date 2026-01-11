#!/usr/bin/env node

/**
 * Validation Script: Firm-Client-Admin Integrity Fixes
 * 
 * PURPOSE:
 * Validates that all integrity issues have been resolved:
 * 1. No firms missing defaultClientId
 * 2. No admins missing defaultClientId
 * 3. All admins' defaultClientId matches their firm's defaultClientId
 * 4. All firms with COMPLETED status have defaultClientId
 * 5. Bootstrap checks pass
 * 
 * USAGE:
 * node scripts/validate-integrity-fixes.js
 * 
 * EXIT CODES:
 * 0 - All validation checks passed
 * 1 - One or more validation checks failed
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Models
const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const Client = require('../src/models/Client.model');

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGO_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI or MONGO_URI not found in environment variables');
    }
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('[VALIDATION] ✓ Connected to MongoDB\n');
  } catch (error) {
    console.error('[VALIDATION] ✗ MongoDB connection error:', error.message);
    throw error;
  }
}

/**
 * Validation Check 1: All firms have defaultClientId
 */
async function validateFirmsHaveDefaultClient() {
  console.log('[CHECK 1] Validating all firms have defaultClientId...');
  
  const firmsMissing = await Firm.find({
    $or: [
      { defaultClientId: null },
      { defaultClientId: { $exists: false } }
    ]
  }).select('firmId name status bootstrapStatus');
  
  if (firmsMissing.length > 0) {
    console.error(`  ✗ FAILED: Found ${firmsMissing.length} firm(s) without defaultClientId:`);
    firmsMissing.forEach(firm => {
      console.error(`    - ${firm.firmId} (${firm.name}) - Status: ${firm.status}, Bootstrap: ${firm.bootstrapStatus}`);
    });
    return false;
  }
  
  const totalFirms = await Firm.countDocuments();
  console.log(`  ✓ PASSED: All ${totalFirms} firm(s) have defaultClientId\n`);
  return true;
}

/**
 * Validation Check 2: All admins have defaultClientId
 */
async function validateAdminsHaveDefaultClient() {
  console.log('[CHECK 2] Validating all admins have defaultClientId...');
  
  const adminsMissing = await User.find({
    role: 'Admin',
    $or: [
      { defaultClientId: null },
      { defaultClientId: { $exists: false } }
    ]
  }).select('xID name email firmId');
  
  if (adminsMissing.length > 0) {
    console.error(`  ✗ FAILED: Found ${adminsMissing.length} admin(s) without defaultClientId:`);
    adminsMissing.forEach(admin => {
      console.error(`    - ${admin.xID} (${admin.name}) - Email: ${admin.email}`);
    });
    return false;
  }
  
  const totalAdmins = await User.countDocuments({ role: 'Admin' });
  console.log(`  ✓ PASSED: All ${totalAdmins} admin(s) have defaultClientId\n`);
  return true;
}

/**
 * Validation Check 3: Admin defaultClientId matches firm defaultClientId
 */
async function validateAdminClientMatchesFirm() {
  console.log('[CHECK 3] Validating admin defaultClientId matches firm defaultClientId...');
  
  const admins = await User.find({ role: 'Admin' }).populate('firmId', 'firmId name defaultClientId');
  const mismatches = [];
  
  for (const admin of admins) {
    if (!admin.firmId) {
      mismatches.push({
        xID: admin.xID,
        name: admin.name,
        issue: 'No firm linked'
      });
      continue;
    }
    
    if (!admin.firmId.defaultClientId) {
      mismatches.push({
        xID: admin.xID,
        name: admin.name,
        firmId: admin.firmId.firmId,
        issue: 'Firm has no defaultClientId'
      });
      continue;
    }
    
    if (admin.defaultClientId.toString() !== admin.firmId.defaultClientId.toString()) {
      mismatches.push({
        xID: admin.xID,
        name: admin.name,
        firmId: admin.firmId.firmId,
        adminClientId: admin.defaultClientId.toString(),
        firmClientId: admin.firmId.defaultClientId.toString(),
        issue: 'Mismatch between admin and firm defaultClientId'
      });
    }
  }
  
  if (mismatches.length > 0) {
    console.error(`  ✗ FAILED: Found ${mismatches.length} admin(s) with mismatched defaultClientId:`);
    mismatches.forEach(m => {
      console.error(`    - ${m.xID} (${m.name}): ${m.issue}`);
      if (m.adminClientId) {
        console.error(`      Admin: ${m.adminClientId}, Firm: ${m.firmClientId}`);
      }
    });
    return false;
  }
  
  console.log(`  ✓ PASSED: All ${admins.length} admin(s) have matching defaultClientId\n`);
  return true;
}

/**
 * Validation Check 4: Completed firms have defaultClientId
 */
async function validateCompletedFirmsHaveClient() {
  console.log('[CHECK 4] Validating COMPLETED firms have defaultClientId...');
  
  const completedWithoutClient = await Firm.find({
    bootstrapStatus: 'COMPLETED',
    $or: [
      { defaultClientId: null },
      { defaultClientId: { $exists: false } }
    ]
  }).select('firmId name status');
  
  if (completedWithoutClient.length > 0) {
    console.error(`  ✗ FAILED: Found ${completedWithoutClient.length} COMPLETED firm(s) without defaultClientId:`);
    completedWithoutClient.forEach(firm => {
      console.error(`    - ${firm.firmId} (${firm.name}) - Status: ${firm.status}`);
    });
    return false;
  }
  
  const completedFirms = await Firm.countDocuments({ bootstrapStatus: 'COMPLETED' });
  console.log(`  ✓ PASSED: All ${completedFirms} COMPLETED firm(s) have defaultClientId\n`);
  return true;
}

/**
 * Validation Check 5: Each firm has exactly one internal client
 */
async function validateFirmInternalClients() {
  console.log('[CHECK 5] Validating each firm has exactly one internal client...');
  
  const firms = await Firm.find().select('firmId name defaultClientId');
  const issues = [];
  
  for (const firm of firms) {
    const internalClients = await Client.countDocuments({
      firmId: firm._id,
      isInternal: true
    });
    
    if (internalClients === 0) {
      issues.push({
        firmId: firm.firmId,
        name: firm.name,
        issue: 'No internal client found'
      });
    } else if (internalClients > 1) {
      issues.push({
        firmId: firm.firmId,
        name: firm.name,
        issue: `Multiple internal clients found: ${internalClients}`
      });
    }
  }
  
  if (issues.length > 0) {
    console.error(`  ✗ FAILED: Found ${issues.length} firm(s) with internal client issues:`);
    issues.forEach(i => {
      console.error(`    - ${i.firmId} (${i.name}): ${i.issue}`);
    });
    return false;
  }
  
  console.log(`  ✓ PASSED: All ${firms.length} firm(s) have exactly one internal client\n`);
  return true;
}

/**
 * Validation Check 6: No pending firms (unless intentional)
 */
async function validateNoPendingFirms() {
  console.log('[CHECK 6] Checking for pending firm bootstraps...');
  
  const pendingFirms = await Firm.find({
    bootstrapStatus: 'PENDING'
  }).select('firmId name createdAt');
  
  if (pendingFirms.length > 0) {
    console.warn(`  ⚠ WARNING: Found ${pendingFirms.length} firm(s) in PENDING state:`);
    pendingFirms.forEach(firm => {
      const age = Math.round((Date.now() - firm.createdAt.getTime()) / (1000 * 60));
      console.warn(`    - ${firm.firmId} (${firm.name}) - Age: ${age} minutes`);
    });
    console.warn(`  ℹ This may be OK if firms are currently being bootstrapped\n`);
    return true; // Warning, not failure
  }
  
  console.log(`  ✓ PASSED: No firms in PENDING state\n`);
  return true;
}

/**
 * Display summary
 */
function displaySummary(results) {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  VALIDATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total Checks:     ${results.length}`);
  console.log(`  Passed:           ${passed}`);
  console.log(`  Failed:           ${failed}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (failed > 0) {
    console.error('❌ VALIDATION FAILED\n');
    console.error('Please run the migration script to fix integrity issues:');
    console.error('  node scripts/migrate-fix-firm-client-integrity.js\n');
    return false;
  }
  
  console.log('✅ ALL VALIDATION CHECKS PASSED\n');
  console.log('System integrity is healthy:');
  console.log('  ✓ All firms have default clients');
  console.log('  ✓ All admins have correct defaultClientId');
  console.log('  ✓ Firm-client-admin hierarchy is consistent');
  console.log('  ✓ Bootstrap checks should pass');
  console.log('  ✓ Login auto-repair should not trigger\n');
  return true;
}

/**
 * Main validation function
 */
async function validate() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  FIRM-CLIENT-ADMIN INTEGRITY VALIDATION');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Connect to database
    await connectDB();
    
    // Run all validation checks
    const results = [
      { name: 'Firms have defaultClientId', passed: await validateFirmsHaveDefaultClient() },
      { name: 'Admins have defaultClientId', passed: await validateAdminsHaveDefaultClient() },
      { name: 'Admin-Firm defaultClientId match', passed: await validateAdminClientMatchesFirm() },
      { name: 'Completed firms have client', passed: await validateCompletedFirmsHaveClient() },
      { name: 'Firm internal clients', passed: await validateFirmInternalClients() },
      { name: 'No pending firms', passed: await validateNoPendingFirms() },
    ];
    
    // Display summary
    const allPassed = displaySummary(results);
    
    // Close connection
    await mongoose.connection.close();
    console.log('[VALIDATION] Database connection closed.\n');
    
    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('[VALIDATION] ✗ Validation failed:', error.message);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run validation
validate();
