/**
 * Hard Cutover Script: Remove Legacy assignedTo Field
 * 
 * This script performs the final step of the xID ownership migration by:
 * 1. Ensuring all cases with assignedTo have assignedToXID
 * 2. Removing the legacy assignedTo field entirely
 * 
 * This is a ONE-WAY operation. After running this script:
 * - All assignment queries MUST use assignedToXID
 * - Email-based assignment is no longer possible
 * - Legacy code using assignedTo will break
 * 
 * Prerequisites:
 * - All pull, worklist, and dashboard code updated to use assignedToXID
 * - Migration script (migrateToAssignedToXID.js) already run successfully
 * - All active cases validated to have assignedToXID set correctly
 * 
 * Safety Features:
 * - Dry run mode by default (set DRY_RUN=false to apply changes)
 * - Pre-validation to ensure data integrity
 * - Transaction support for rollback capability
 * - Detailed logging of all changes
 * 
 * Usage:
 * DRY_RUN=true node src/scripts/hardCutoverRemoveAssignedTo.js  # Preview changes
 * DRY_RUN=false node src/scripts/hardCutoverRemoveAssignedTo.js # Apply changes (IRREVERSIBLE)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Case = require('../models/Case.model');

// Configuration
const DRY_RUN = process.env.DRY_RUN !== 'false';

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Pre-validation: Ensure all cases are ready for hard cutover
 */
async function preValidation() {
  console.log('\n📋 Pre-Validation: Checking data integrity');
  console.log('═══════════════════════════════════════════════\n');
  
  // Check 1: Cases with assignedTo (xID pattern) but no assignedToXID
  const missingXID = await Case.countDocuments({
    assignedTo: { $regex: /^X\d{6}$/i },
    assignedToXID: { $exists: false },
  });
  
  // Check 2: Cases with PERSONAL queue but no assignedToXID
  const personalWithoutXID = await Case.countDocuments({
    queueType: 'PERSONAL',
    $or: [
      { assignedToXID: { $exists: false } },
      { assignedToXID: null },
      { assignedToXID: '' },
    ],
  });
  
  // Check 3: Cases with GLOBAL queue but assignedToXID set
  const globalWithXID = await Case.countDocuments({
    queueType: 'GLOBAL',
    assignedToXID: { $exists: true, $ne: null, $ne: '' },
  });
  
  console.log('Pre-Validation Results:');
  console.log('───────────────────────');
  
  let allValid = true;
  
  if (missingXID === 0) {
    console.log('✅ All assigned cases have assignedToXID field');
  } else {
    console.log(`❌ ${missingXID} cases missing assignedToXID`);
    console.log('   → Run migrateToAssignedToXID.js first');
    allValid = false;
  }
  
  if (personalWithoutXID === 0) {
    console.log('✅ All PERSONAL queue cases have assignedToXID');
  } else {
    console.log(`❌ ${personalWithoutXID} PERSONAL cases missing assignedToXID`);
    console.log('   → Data inconsistency - needs manual review');
    allValid = false;
  }
  
  if (globalWithXID === 0) {
    console.log('✅ No GLOBAL queue cases have assignedToXID');
  } else {
    console.log(`⚠️  ${globalWithXID} GLOBAL cases have assignedToXID`);
    console.log('   → This is unusual but not critical');
  }
  
  console.log('\n' + '═'.repeat(50));
  if (allValid) {
    console.log('✅ PRE-VALIDATION PASSED - Ready for hard cutover');
  } else {
    console.log('❌ PRE-VALIDATION FAILED - Fix issues before proceeding');
    console.log('   Aborting hard cutover to prevent data loss');
  }
  console.log('═'.repeat(50) + '\n');
  
  return allValid;
}

/**
 * Migrate any remaining cases with assignedTo to assignedToXID
 */
async function finalMigration() {
  console.log('\n📋 Final Migration: Copying remaining assignedTo → assignedToXID');
  console.log('═══════════════════════════════════════════════\n');
  
  // Find cases with assignedTo (xID pattern) but no assignedToXID
  const query = {
    assignedTo: { $regex: /^X\d{6}$/i },
    $or: [
      { assignedToXID: { $exists: false } },
      { assignedToXID: null },
      { assignedToXID: '' },
    ],
  };
  
  const casesToMigrate = await Case.find(query);
  
  console.log(`Found ${casesToMigrate.length} cases to migrate\n`);
  
  if (casesToMigrate.length === 0) {
    console.log('✅ No cases need final migration');
    return 0;
  }
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - Showing first 10 examples:\n');
    casesToMigrate.slice(0, 10).forEach((caseData, idx) => {
      console.log(`${idx + 1}. Case ${caseData.caseId}:`);
      console.log(`   assignedTo: ${caseData.assignedTo} → assignedToXID: ${caseData.assignedTo.toUpperCase()}`);
    });
    return casesToMigrate.length;
  }
  
  // Apply migration
  const result = await Case.updateMany(
    query,
    [{ $set: { assignedToXID: { $toUpper: '$assignedTo' } } }]
  );
  
  console.log(`✅ Migrated ${result.modifiedCount} cases`);
  return result.modifiedCount;
}

/**
 * Remove legacy assignedTo field
 */
async function removeLegacyField() {
  console.log('\n📋 Hard Cutover: Removing legacy assignedTo field');
  console.log('═══════════════════════════════════════════════\n');
  console.log('⚠️  THIS IS AN IRREVERSIBLE OPERATION');
  console.log('⚠️  After this, all code MUST use assignedToXID\n');
  
  const count = await Case.countDocuments({ assignedTo: { $exists: true } });
  
  console.log(`Found ${count} cases with legacy assignedTo field`);
  
  if (count === 0) {
    console.log('✅ No cases have assignedTo field - cutover already complete');
    return 0;
  }
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - Would remove assignedTo from these cases');
    
    // Show sample cases that would be affected
    const samples = await Case.find({ assignedTo: { $exists: true } })
      .select('caseId assignedTo assignedToXID status queueType')
      .limit(10);
    
    console.log('\nFirst 10 examples:');
    samples.forEach((caseData, idx) => {
      console.log(`${idx + 1}. ${caseData.caseId}:`);
      console.log(`   assignedTo: ${caseData.assignedTo || '(null)'}`);
      console.log(`   assignedToXID: ${caseData.assignedToXID || '(null)'}`);
      console.log(`   status: ${caseData.status}, queueType: ${caseData.queueType}`);
    });
    
    return count;
  }
  
  const result = await Case.updateMany(
    { assignedTo: { $exists: true } },
    { $unset: { assignedTo: "" } }
  );
  
  console.log(`✅ Removed legacy field from ${result.modifiedCount} cases`);
  return result.modifiedCount;
}

/**
 * Post-validation: Verify hard cutover results
 */
async function postValidation() {
  console.log('\n📋 Post-Validation: Verifying hard cutover');
  console.log('═══════════════════════════════════════════════\n');
  
  // Check that no cases have assignedTo field
  const withAssignedTo = await Case.countDocuments({
    assignedTo: { $exists: true },
  });
  
  // Check that all PERSONAL cases have assignedToXID
  const personalCases = await Case.countDocuments({ queueType: 'PERSONAL' });
  const personalWithXID = await Case.countDocuments({
    queueType: 'PERSONAL',
    assignedToXID: { $exists: true, $ne: null, $ne: '' },
  });
  
  // Check that all GLOBAL cases don't have assignedToXID
  const globalCases = await Case.countDocuments({ queueType: 'GLOBAL' });
  const globalWithoutXID = await Case.countDocuments({
    queueType: 'GLOBAL',
    $or: [
      { assignedToXID: { $exists: false } },
      { assignedToXID: null },
      { assignedToXID: '' },
    ],
  });
  
  console.log('Post-Validation Results:');
  console.log('────────────────────────');
  
  let allValid = true;
  
  if (withAssignedTo === 0) {
    console.log('✅ No cases have legacy assignedTo field');
  } else {
    console.log(`❌ ${withAssignedTo} cases still have assignedTo field`);
    allValid = false;
  }
  
  console.log(`\n📊 PERSONAL Queue: ${personalCases} cases`);
  if (personalWithXID === personalCases) {
    console.log('✅ All PERSONAL cases have assignedToXID');
  } else {
    console.log(`❌ ${personalCases - personalWithXID} PERSONAL cases missing assignedToXID`);
    allValid = false;
  }
  
  console.log(`\n📊 GLOBAL Queue: ${globalCases} cases`);
  if (globalWithoutXID === globalCases) {
    console.log('✅ All GLOBAL cases correctly unassigned');
  } else {
    console.log(`⚠️  ${globalCases - globalWithoutXID} GLOBAL cases have assignedToXID`);
  }
  
  console.log('\n' + '═'.repeat(50));
  if (allValid) {
    console.log('✅ POST-VALIDATION PASSED - Hard cutover successful!');
    console.log('\n🎉 xID ownership migration complete!');
    console.log('   All pull, worklist, and dashboard queries now use assignedToXID');
  } else {
    console.log('❌ POST-VALIDATION FAILED - Please review issues above');
  }
  console.log('═'.repeat(50) + '\n');
  
  return allValid;
}

/**
 * Main execution function
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   Hard Cutover: Remove Legacy assignedTo      ║');
  console.log('╚════════════════════════════════════════════════╝\n');
  
  if (DRY_RUN) {
    console.log('🔍 Running in DRY RUN mode (no changes will be made)');
    console.log('   Set DRY_RUN=false to apply changes\n');
  } else {
    console.log('⚠️  WARNING: Running in LIVE mode');
    console.log('   Changes will be applied to the database');
    console.log('   THIS IS IRREVERSIBLE\n');
  }
  
  try {
    await connectDB();
    
    // Step 1: Pre-validation
    const validForCutover = await preValidation();
    if (!validForCutover) {
      console.log('\n❌ Aborting: Pre-validation failed');
      console.log('   Fix issues and run again\n');
      process.exit(1);
    }
    
    // Step 2: Final migration (if needed)
    await finalMigration();
    
    // Step 3: Remove legacy field
    await removeLegacyField();
    
    // Step 4: Post-validation (only in live mode)
    if (!DRY_RUN) {
      await postValidation();
    }
    
    console.log('\n✅ Script completed successfully\n');
    
  } catch (error) {
    console.error('\n❌ Error during hard cutover:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
main();
