#!/usr/bin/env node

/**
 * COMPREHENSIVE Migration Script: Firm-Client-Admin Integrity Fix
 * 
 * PURPOSE:
 * 1. Finds firms missing defaultClientId
 * 2. Creates system-owned default client for each firm
 * 3. Links firm to default client
 * 4. Backfills all admins of that firm with defaultClientId
 * 5. Ensures data integrity across the entire firm hierarchy
 * 
 * USAGE:
 * node scripts/migrate-fix-firm-client-integrity.js
 * 
 * WHEN TO RUN:
 * - Once per environment (staging, production)
 * - Before deploying auth/bootstrap fixes
 * - After any firm creation issues
 * 
 * SAFETY:
 * - Read-only scan first to preview changes
 * - Prompts for confirmation before applying changes
 * - Uses transactions for atomicity
 * - Logs all changes for audit trail
 * - Idempotent - safe to run multiple times
 * - Validates before and after migration
 */

require('dotenv').config();
const mongoose = require('mongoose');
const readline = require('readline');

// Models
const User = require('../src/models/User.model');
const Firm = require('../src/models/Firm.model');
const Client = require('../src/models/Client.model');

// Services
const { generateNextClientId } = require('../src/services/clientIdGenerator');

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
 * Find firms missing defaultClientId
 */
async function findFirmsMissingDefaultClient() {
  try {
    const firms = await Firm.find({
      $or: [
        { defaultClientId: null },
        { defaultClientId: { $exists: false } }
      ]
    });
    
    console.log(`[MIGRATION] Found ${firms.length} firm(s) missing defaultClientId\n`);
    
    return firms;
  } catch (error) {
    console.error('[MIGRATION] Error finding firms:', error.message);
    throw error;
  }
}

/**
 * Find all Admin users missing defaultClientId
 */
async function findAdminsMissingDefaultClient() {
  try {
    const admins = await User.find({
      role: 'Admin',
      $or: [
        { defaultClientId: null },
        { defaultClientId: { $exists: false } }
      ]
    }).populate('firmId', 'firmId name defaultClientId bootstrapStatus');
    
    console.log(`[MIGRATION] Found ${admins.length} Admin user(s) missing defaultClientId\n`);
    
    return admins;
  } catch (error) {
    console.error('[MIGRATION] Error finding admins:', error.message);
    throw error;
  }
}

/**
 * Analyze migration requirements
 */
async function analyzeMigration() {
  const report = {
    firmsMissingClient: [],
    adminsNeedingUpdate: [],
    totalFirms: 0,
    totalAdmins: 0,
    firmsToFix: 0,
    adminsToFix: 0,
  };
  
  // Find firms missing default client
  const firms = await findFirmsMissingDefaultClient();
  report.totalFirms = firms.length;
  
  for (const firm of firms) {
    // Count admins in this firm
    const adminCount = await User.countDocuments({ 
      firmId: firm._id, 
      role: 'Admin' 
    });
    
    report.firmsMissingClient.push({
      firmId: firm.firmId,
      name: firm.name,
      _id: firm._id,
      adminCount,
      status: firm.status,
      bootstrapStatus: firm.bootstrapStatus,
    });
    
    report.firmsToFix++;
  }
  
  // Find admins missing default client
  const admins = await findAdminsMissingDefaultClient();
  report.totalAdmins = admins.length;
  
  for (const admin of admins) {
    const detail = {
      xID: admin.xID,
      name: admin.name,
      email: admin.email,
      firmId: admin.firmId ? admin.firmId.firmId : 'MISSING',
      firmName: admin.firmId ? admin.firmId.name : 'MISSING',
      firmHasDefaultClient: admin.firmId && admin.firmId.defaultClientId ? true : false,
    };
    
    if (!admin.firmId) {
      detail.action = 'ERROR: No firm linked - SKIP';
    } else if (admin.firmId.defaultClientId) {
      detail.action = `Set to firm's defaultClientId: ${admin.firmId.defaultClientId}`;
      report.adminsToFix++;
    } else {
      detail.action = 'WAIT: Firm needs default client first';
    }
    
    report.adminsNeedingUpdate.push(detail);
  }
  
  return report;
}

/**
 * Display migration report
 */
function displayReport(report) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FIRM-CLIENT-ADMIN INTEGRITY MIGRATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Firms missing defaultClientId:     ${report.totalFirms}`);
  console.log(`  Firms to be fixed:                 ${report.firmsToFix}`);
  console.log(`  Admins missing defaultClientId:    ${report.totalAdmins}`);
  console.log(`  Admins to be fixed:                ${report.adminsToFix}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (report.firmsMissingClient.length > 0) {
    console.log('FIRMS REQUIRING DEFAULT CLIENT:\n');
    
    report.firmsMissingClient.forEach((firm, index) => {
      console.log(`${index + 1}. Firm: ${firm.firmId} (${firm.name})`);
      console.log(`   MongoDB _id: ${firm._id}`);
      console.log(`   Status: ${firm.status}`);
      console.log(`   Bootstrap Status: ${firm.bootstrapStatus || 'N/A'}`);
      console.log(`   Admins in firm: ${firm.adminCount}`);
      console.log(`   Action: Create default client + update firm + backfill admins`);
      console.log('');
    });
  }
  
  if (report.adminsNeedingUpdate.length > 0) {
    console.log('ADMINS REQUIRING defaultClientId:\n');
    
    report.adminsNeedingUpdate.forEach((admin, index) => {
      console.log(`${index + 1}. Admin: ${admin.xID} (${admin.name})`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Firm: ${admin.firmId} - ${admin.firmName}`);
      console.log(`   Firm has defaultClient: ${admin.firmHasDefaultClient ? 'YES' : 'NO'}`);
      console.log(`   Action: ${admin.action}`);
      console.log('');
    });
  }
}

/**
 * Fix a single firm by creating default client and updating admins
 */
async function fixFirm(firm, session) {
  const actions = [];
  
  try {
    console.log(`\n[MIGRATION] Processing firm: ${firm.firmId} (${firm.name})`);
    
    // Step 1: Check if firm already has an internal client
    const existingClient = await Client.findOne({
      firmId: firm._id,
      isInternal: true
    }).session(session);
    
    let defaultClient;
    
    if (existingClient) {
      console.log(`[MIGRATION]   Found existing internal client: ${existingClient.clientId}`);
      defaultClient = existingClient;
      actions.push(`Used existing internal client: ${existingClient.clientId}`);
    } else {
      // Step 2: Create default client for the firm
      const clientId = await generateNextClientId(firm._id, session);
      
      defaultClient = new Client({
        clientId,
        businessName: firm.name,
        businessAddress: 'Default Address',
        primaryContactNumber: '0000000000',
        businessEmail: `${firm.firmId.toLowerCase()}@system.local`,
        firmId: firm._id,
        isSystemClient: true,
        isInternal: true,
        createdBySystem: true,
        isActive: true,
        status: 'ACTIVE',
        createdByXid: 'SUPERADMIN',
        createdBy: process.env.SUPERADMIN_EMAIL || 'superadmin@system.local',
      });
      
      await defaultClient.save({ session });
      console.log(`[MIGRATION]   ✓ Created default client: ${clientId}`);
      actions.push(`Created default client: ${clientId}`);
    }
    
    // Step 3: Link firm to default client
    firm.defaultClientId = defaultClient._id;
    
    // Step 4: Mark firm bootstrap as COMPLETED if it's PENDING
    if (!firm.bootstrapStatus || firm.bootstrapStatus === 'PENDING') {
      firm.bootstrapStatus = 'COMPLETED';
      actions.push('Updated bootstrapStatus to COMPLETED');
      console.log(`[MIGRATION]   ✓ Set bootstrapStatus to COMPLETED`);
    }
    
    await firm.save({ session });
    console.log(`[MIGRATION]   ✓ Linked firm to defaultClientId: ${defaultClient._id}`);
    actions.push(`Linked firm to defaultClientId`);
    
    // Step 5: Backfill all admins in this firm
    const admins = await User.find({
      firmId: firm._id,
      role: 'Admin',
      $or: [
        { defaultClientId: null },
        { defaultClientId: { $exists: false } }
      ]
    }).session(session);
    
    console.log(`[MIGRATION]   Found ${admins.length} admin(s) needing defaultClientId`);
    
    for (const admin of admins) {
      await User.updateOne(
        { _id: admin._id },
        { $set: { defaultClientId: defaultClient._id } },
        { session }
      );
      console.log(`[MIGRATION]   ✓ Updated admin ${admin.xID} with defaultClientId`);
      actions.push(`Updated admin ${admin.xID}`);
    }
    
    return {
      success: true,
      firmId: firm.firmId,
      clientId: defaultClient.clientId,
      adminsUpdated: admins.length,
      actions
    };
    
  } catch (error) {
    console.error(`[MIGRATION]   ✗ Failed to fix firm ${firm.firmId}:`, error.message);
    throw error;
  }
}

/**
 * Apply migration (with transactions)
 */
async function applyMigration(report) {
  if (report.firmsToFix === 0 && report.adminsToFix === 0) {
    console.log('[MIGRATION] No fixes needed. System is healthy!\n');
    return { firmsFixed: 0, adminsFixed: 0, failed: 0 };
  }
  
  console.log(`[MIGRATION] Starting migration...\n`);
  
  const results = {
    firmsFixed: 0,
    adminsFixed: 0,
    failed: 0,
    details: []
  };
  
  // Process each firm in a separate transaction
  for (const firmInfo of report.firmsMissingClient) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const firm = await Firm.findById(firmInfo._id).session(session);
      
      if (!firm) {
        console.error(`[MIGRATION] ✗ Firm not found: ${firmInfo.firmId}`);
        await session.abortTransaction();
        session.endSession();
        results.failed++;
        continue;
      }
      
      const result = await fixFirm(firm, session);
      
      await session.commitTransaction();
      session.endSession();
      
      console.log(`[MIGRATION] ✓✓✓ Successfully fixed firm: ${result.firmId}`);
      results.firmsFixed++;
      results.adminsFixed += result.adminsUpdated;
      results.details.push(result);
      
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      
      console.error(`[MIGRATION] ✗ Transaction failed for firm ${firmInfo.firmId}:`, error.message);
      results.failed++;
      results.details.push({
        success: false,
        firmId: firmInfo.firmId,
        error: error.message
      });
    }
  }
  
  // Now fix any remaining admins whose firms now have defaultClientId
  // (This handles admins from firms that already had clients but admins were not updated)
  const remainingAdmins = await User.find({
    role: 'Admin',
    $or: [
      { defaultClientId: null },
      { defaultClientId: { $exists: false } }
    ]
  }).populate('firmId', 'firmId name defaultClientId');
  
  for (const admin of remainingAdmins) {
    if (admin.firmId && admin.firmId.defaultClientId) {
      try {
        await User.updateOne(
          { _id: admin._id },
          { $set: { defaultClientId: admin.firmId.defaultClientId } }
        );
        console.log(`[MIGRATION] ✓ Updated orphan admin ${admin.xID}`);
        results.adminsFixed++;
      } catch (error) {
        console.error(`[MIGRATION] ✗ Failed to update admin ${admin.xID}:`, error.message);
        results.failed++;
      }
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
  console.log(`  Firms fixed:          ${results.firmsFixed}`);
  console.log(`  Admins fixed:         ${results.adminsFixed}`);
  console.log(`  Failed operations:    ${results.failed}`);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (results.details.length > 0) {
    console.log('DETAILED RESULTS:\n');
    
    results.details.forEach((detail, index) => {
      if (detail.success) {
        console.log(`${index + 1}. ✓ Firm: ${detail.firmId}`);
        console.log(`   Client: ${detail.clientId}`);
        console.log(`   Admins updated: ${detail.adminsUpdated}`);
        console.log(`   Actions: ${detail.actions.join(', ')}`);
      } else {
        console.log(`${index + 1}. ✗ Firm: ${detail.firmId}`);
        console.log(`   Error: ${detail.error}`);
      }
      console.log('');
    });
  }
}

/**
 * Validate migration results
 */
async function validateMigration() {
  console.log('[MIGRATION] Validating migration results...\n');
  
  // Check for firms still missing defaultClientId
  const firmsMissing = await Firm.countDocuments({
    $or: [
      { defaultClientId: null },
      { defaultClientId: { $exists: false } }
    ]
  });
  
  // Check for admins still missing defaultClientId
  const adminsMissing = await User.countDocuments({
    role: 'Admin',
    $or: [
      { defaultClientId: null },
      { defaultClientId: { $exists: false } }
    ]
  });
  
  console.log('VALIDATION RESULTS:');
  console.log(`  Firms still missing defaultClientId:  ${firmsMissing}`);
  console.log(`  Admins still missing defaultClientId: ${adminsMissing}`);
  
  if (firmsMissing === 0 && adminsMissing === 0) {
    console.log('\n✓✓✓ VALIDATION PASSED: All integrity issues resolved!\n');
    return true;
  } else {
    console.log('\n⚠ VALIDATION WARNING: Some issues remain. Manual intervention may be required.\n');
    return false;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  FIRM-CLIENT-ADMIN INTEGRITY MIGRATION');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  This script will:');
    console.log('  1. Find firms missing defaultClientId');
    console.log('  2. Create default client for each firm');
    console.log('  3. Link firms to their default clients');
    console.log('  4. Backfill all admins with correct defaultClientId');
    console.log('  5. Validate the migration');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Connect to database
    await connectDB();
    
    // Step 1: Analyze migration requirements
    console.log('[MIGRATION] Step 1: Analyzing system integrity...\n');
    const report = await analyzeMigration();
    
    // Step 2: Display report
    displayReport(report);
    
    if (report.firmsToFix === 0 && report.adminsToFix === 0) {
      console.log('[MIGRATION] ✓ No integrity issues found. System is healthy!');
      console.log('[MIGRATION] Migration not needed.\n');
      return;
    }
    
    // Step 3: Prompt for confirmation
    const answer = await question(
      `[MIGRATION] Proceed with fixing ${report.firmsToFix} firm(s) and ${report.adminsToFix} admin(s)? (yes/no): `
    );
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('[MIGRATION] Migration cancelled by user.\n');
      return;
    }
    
    // Step 4: Apply migration
    console.log('[MIGRATION] Step 4: Applying fixes...\n');
    const results = await applyMigration(report);
    
    // Step 5: Display results
    displayResults(results);
    
    // Step 6: Validate migration
    const isValid = await validateMigration();
    
    if (results.failed > 0) {
      console.log('[MIGRATION] ⚠ Migration completed with errors. Please review failed operations.\n');
      process.exit(1);
    } else if (!isValid) {
      console.log('[MIGRATION] ⚠ Migration completed but validation found remaining issues.\n');
      process.exit(1);
    } else {
      console.log('[MIGRATION] ✓✓✓ Migration completed successfully!\n');
      console.log('[MIGRATION] System integrity restored:');
      console.log('[MIGRATION]   - All firms have default clients');
      console.log('[MIGRATION]   - All admins have correct defaultClientId');
      console.log('[MIGRATION]   - Bootstrap checks will pass');
      console.log('[MIGRATION]   - Login auto-repair will not trigger\n');
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
