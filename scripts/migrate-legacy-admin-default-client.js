#!/usr/bin/env node

/**
 * One-Time Migration Script: Legacy Admin defaultClientId Auto-Repair
 * 
 * PURPOSE:
 * - Finds all Admin users where defaultClientId is missing
 * - Resolves correct client from firm's defaultClientId
 * - Persists values to eliminate runtime auto-repair
 * 
 * USAGE:
 * node scripts/migrate-legacy-admin-default-client.js
 * 
 * WHEN TO RUN:
 * - Once in staging environment
 * - Once in production environment
 * - Can be safely removed after execution
 * 
 * SAFETY:
 * - Read-only scan first to preview changes
 * - Prompts for confirmation before applying changes
 * - Logs all changes for audit trail
 * - Idempotent - safe to run multiple times
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// Models
const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify question for async/await usage
const question = (prompt) => {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
};

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
    
    console.log('[MIGRATION] ✓ Connected to MongoDB');
  } catch (error) {
    console.error('[MIGRATION] ✗ MongoDB connection error:', error.message);
    throw error;
  }
}

/**
 * Find all Admin users missing defaultClientId
 */
async function findLegacyAdmins() {
  try {
    // Query for Admin users where defaultClientId is null, undefined, or missing
    // Using $or to catch all possible cases of missing defaultClientId
    const admins = await User.find({
      role: 'Admin',
      $or: [
        { defaultClientId: null },
        { defaultClientId: { $exists: false } }
      ]
    }).populate('firmId', 'firmId name defaultClientId bootstrapStatus');
    
    console.log(`\n[MIGRATION] Found ${admins.length} Admin users missing defaultClientId\n`);
    
    return admins;
  } catch (error) {
    console.error('[MIGRATION] Error finding legacy admins:', error.message);
    throw error;
  }
}

/**
 * Analyze migration candidates
 */
async function analyzeMigration(admins) {
  const report = {
    total: admins.length,
    repairable: 0,
    notRepairable: 0,
    details: []
  };
  
  for (const admin of admins) {
    const detail = {
      xID: admin.xID,
      name: admin.name,
      email: admin.email,
      firmId: admin.firmId ? admin.firmId.firmId : 'MISSING',
      firmName: admin.firmId ? admin.firmId.name : 'MISSING',
      status: 'UNKNOWN'
    };
    
    // Check if firm exists
    if (!admin.firmId) {
      detail.status = 'ERROR: No firm linked';
      detail.action = 'SKIP - Manual intervention required';
      report.notRepairable++;
    }
    // Check if firm has defaultClientId
    else if (!admin.firmId.defaultClientId) {
      detail.status = 'ERROR: Firm has no defaultClientId';
      detail.action = 'SKIP - Firm bootstrap incomplete';
      report.notRepairable++;
    }
    // Check if firm bootstrap is complete
    else if (admin.firmId.bootstrapStatus !== 'COMPLETED') {
      detail.status = `ERROR: Firm bootstrap status is ${admin.firmId.bootstrapStatus}`;
      detail.action = 'SKIP - Wait for firm bootstrap completion';
      report.notRepairable++;
    }
    // All checks passed - can be repaired
    else {
      detail.status = 'OK: Can be repaired';
      detail.action = `Set defaultClientId to ${admin.firmId.defaultClientId}`;
      detail.targetClientId = admin.firmId.defaultClientId;
      report.repairable++;
    }
    
    report.details.push(detail);
  }
  
  return report;
}

/**
 * Display migration report
 */
function displayReport(report) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION ANALYSIS REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Total Admin users found:        ${report.total}`);
  console.log(`  Can be repaired automatically:  ${report.repairable}`);
  console.log(`  Require manual intervention:    ${report.notRepairable}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (report.details.length > 0) {
    console.log('DETAILED BREAKDOWN:\n');
    
    report.details.forEach((detail, index) => {
      console.log(`${index + 1}. Admin: ${detail.xID} (${detail.name})`);
      console.log(`   Email: ${detail.email}`);
      console.log(`   Firm: ${detail.firmId} - ${detail.firmName}`);
      console.log(`   Status: ${detail.status}`);
      console.log(`   Action: ${detail.action}`);
      console.log('');
    });
  }
}

/**
 * Apply migration (update database)
 */
async function applyMigration(report) {
  const repairableAdmins = report.details.filter(d => d.targetClientId);
  
  if (repairableAdmins.length === 0) {
    console.log('[MIGRATION] No admins to repair. Migration complete.\n');
    return { success: 0, failed: 0 };
  }
  
  console.log(`[MIGRATION] Starting migration for ${repairableAdmins.length} admins...\n`);
  
  const results = {
    success: 0,
    failed: 0,
    details: []
  };
  
  for (const detail of repairableAdmins) {
    try {
      // Update the admin user
      const updateResult = await User.updateOne(
        { xID: detail.xID },
        { $set: { defaultClientId: detail.targetClientId } }
      );
      
      if (updateResult.modifiedCount > 0) {
        console.log(`[MIGRATION] ✓ Updated ${detail.xID} - Set defaultClientId to ${detail.targetClientId}`);
        results.success++;
        results.details.push({
          xID: detail.xID,
          status: 'SUCCESS',
          message: 'defaultClientId updated'
        });
      } else {
        console.log(`[MIGRATION] ⚠ No changes for ${detail.xID} - May already be updated`);
        results.details.push({
          xID: detail.xID,
          status: 'SKIPPED',
          message: 'No changes needed'
        });
      }
    } catch (error) {
      console.error(`[MIGRATION] ✗ Failed to update ${detail.xID}:`, error.message);
      results.failed++;
      results.details.push({
        xID: detail.xID,
        status: 'FAILED',
        message: error.message
      });
    }
  }
  
  return results;
}

/**
 * Display final results
 */
function displayResults(results) {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION RESULTS');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Successfully updated:  ${results.success}`);
  console.log(`  Failed to update:      ${results.failed}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (results.failed > 0) {
    console.log('FAILED UPDATES:\n');
    results.details
      .filter(d => d.status === 'FAILED')
      .forEach(detail => {
        console.log(`  ✗ ${detail.xID}: ${detail.message}`);
      });
    console.log('');
  }
}

/**
 * Main migration function
 */
async function migrate() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  LEGACY ADMIN defaultClientId MIGRATION');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  This script will:');
    console.log('  1. Find all Admin users missing defaultClientId');
    console.log('  2. Resolve correct client from firm\'s defaultClientId');
    console.log('  3. Update database to persist values');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Connect to database
    await connectDB();
    
    // Step 1: Find legacy admins
    console.log('[MIGRATION] Step 1: Scanning for legacy Admin users...');
    const admins = await findLegacyAdmins();
    
    if (admins.length === 0) {
      console.log('[MIGRATION] ✓ No legacy admins found. All admins have defaultClientId set.');
      console.log('[MIGRATION] Migration not needed.\n');
      return;
    }
    
    // Step 2: Analyze migration
    console.log('[MIGRATION] Step 2: Analyzing migration candidates...');
    const report = await analyzeMigration(admins);
    
    // Step 3: Display report
    displayReport(report);
    
    // Step 4: Prompt for confirmation
    if (report.repairable > 0) {
      const answer = await question(
        `[MIGRATION] Proceed with updating ${report.repairable} admin user(s)? (yes/no): `
      );
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('[MIGRATION] Migration cancelled by user.\n');
        return;
      }
      
      // Step 5: Apply migration
      console.log('[MIGRATION] Step 5: Applying migration...\n');
      const results = await applyMigration(report);
      
      // Step 6: Display results
      displayResults(results);
      
      if (results.failed > 0) {
        console.log('[MIGRATION] ⚠ Migration completed with errors. Please review failed updates.\n');
      } else {
        console.log('[MIGRATION] ✓ Migration completed successfully!\n');
        console.log('[MIGRATION] All legacy admins now have defaultClientId set.');
        console.log('[MIGRATION] Runtime auto-repair will no longer trigger on login.\n');
      }
    } else {
      console.log('[MIGRATION] No admins can be automatically repaired.');
      console.log('[MIGRATION] Manual intervention required for admins listed above.\n');
    }
    
  } catch (error) {
    console.error('[MIGRATION] ✗ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // Close readline and database connection
    rl.close();
    await mongoose.connection.close();
    console.log('[MIGRATION] Database connection closed.');
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('[MIGRATION] Script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[MIGRATION] Script failed:', error);
    process.exit(1);
  });
