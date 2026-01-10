/**
 * Migration Script: Setup Firm and Update User References
 * 
 * This script:
 * 1. Creates the default FIRM001 organization if it doesn't exist
 * 2. Updates all existing users to reference the Firm ObjectId instead of string
 * 3. Ensures data integrity during the firmId migration
 * 
 * Run with: node src/scripts/migrateToFirmModel.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Firm = require('../models/Firm.model');
const User = require('../models/User.model');
const Client = require('../models/Client.model');
const Case = require('../models/Case.model');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra';
const DEFAULT_FIRM_ID = 'FIRM001';
const DEFAULT_FIRM_NAME = process.env.DEFAULT_FIRM_NAME || "Sarvesh's Org";

async function runMigration() {
  try {
    console.log('[MIGRATION] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[MIGRATION] Connected to MongoDB');

    // Step 1: Create or find default firm
    console.log('\n[MIGRATION] Step 1: Creating/Finding default firm...');
    let defaultFirm = await Firm.findOne({ firmId: DEFAULT_FIRM_ID });
    
    if (!defaultFirm) {
      console.log(`[MIGRATION] Creating default firm: ${DEFAULT_FIRM_ID} - ${DEFAULT_FIRM_NAME}`);
      defaultFirm = await Firm.create({
        firmId: DEFAULT_FIRM_ID,
        name: DEFAULT_FIRM_NAME,
        status: 'ACTIVE',
      });
      console.log(`[MIGRATION] ✓ Default firm created: ${defaultFirm._id}`);
    } else {
      console.log(`[MIGRATION] ✓ Default firm already exists: ${defaultFirm._id}`);
    }

    // Step 2: Update users - migrate string firmId to ObjectId reference
    console.log('\n[MIGRATION] Step 2: Updating users...');
    const usersToUpdate = await User.find({ 
      $or: [
        { firmId: DEFAULT_FIRM_ID }, // String format
        { firmId: { $type: 'string' } }, // Any string firmId
      ]
    });
    
    console.log(`[MIGRATION] Found ${usersToUpdate.length} users to update`);
    
    let updatedUsers = 0;
    for (const user of usersToUpdate) {
      try {
        // Update using updateOne to bypass immutability for migration
        await User.updateOne(
          { _id: user._id },
          { $set: { firmId: defaultFirm._id } }
        );
        
        // Add restrictedClientIds if it doesn't exist
        await User.updateOne(
          { _id: user._id, restrictedClientIds: { $exists: false } },
          { $set: { restrictedClientIds: [] } }
        );
        
        updatedUsers++;
        console.log(`[MIGRATION]   ✓ Updated user: ${user.xID}`);
      } catch (err) {
        console.error(`[MIGRATION]   ✗ Failed to update user ${user.xID}:`, err.message);
      }
    }
    
    console.log(`[MIGRATION] ✓ Updated ${updatedUsers} users`);

    // Step 3: Verify migration
    console.log('\n[MIGRATION] Step 3: Verifying migration...');
    const verifyUsers = await User.find({ firmId: defaultFirm._id }).limit(5);
    console.log(`[MIGRATION] Sample users with new firmId ObjectId:`);
    verifyUsers.forEach(user => {
      console.log(`[MIGRATION]   - ${user.xID}: firmId type = ${typeof user.firmId}, value = ${user.firmId}`);
    });

    // Count users with string firmId (should be 0)
    const remainingStringFirmIds = await User.countDocuments({ 
      firmId: { $type: 'string' } 
    });
    
    if (remainingStringFirmIds > 0) {
      console.warn(`[MIGRATION] ⚠️  Warning: ${remainingStringFirmIds} users still have string firmId`);
    } else {
      console.log('[MIGRATION] ✓ All users have ObjectId firmId references');
    }

    console.log('\n[MIGRATION] ✓ Migration completed successfully');
    console.log('[MIGRATION] Summary:');
    console.log(`[MIGRATION]   - Firm created/found: ${defaultFirm.firmId} (${defaultFirm.name})`);
    console.log(`[MIGRATION]   - Users updated: ${updatedUsers}`);
    console.log(`[MIGRATION]   - Remaining string firmIds: ${remainingStringFirmIds}`);

  } catch (error) {
    console.error('[MIGRATION] ✗ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n[MIGRATION] Disconnected from MongoDB');
  }
}

// Run migration
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('[MIGRATION] Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[MIGRATION] Script failed:', error);
      process.exit(1);
    });
}

module.exports = { runMigration };
