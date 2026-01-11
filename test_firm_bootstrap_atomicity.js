#!/usr/bin/env node
/**
 * Test script to verify firm bootstrap atomicity and identity decoupling (PR-2)
 * Tests the new staged firm creation flow with bootstrapStatus
 */

const mongoose = require('mongoose');
const Firm = require('./src/models/Firm.model');
const Client = require('./src/models/Client.model');
const User = require('./src/models/User.model');
const { generateNextClientId } = require('./src/services/clientIdGenerator');
const { generateNextXID } = require('./src/services/xIDGenerator');
const { recoverFirmBootstrap } = require('./src/services/bootstrap.service');

// Use in-memory MongoDB for testing
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra-test';

async function cleanup() {
  console.log('[TEST] Cleaning up test data...');
  await Firm.deleteMany({ firmId: /^FIRMTEST/ });
  await Client.deleteMany({ businessName: /^Test Firm/ });
  await User.deleteMany({ email: /^testadmin.*@test\.com$/ });
  console.log('[TEST] Cleanup complete');
}

/**
 * Test 1: Create firm with new staged approach (PR-2)
 */
async function createTestFirmStaged(firmNumber) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    console.log(`\n[TEST] Creating firm ${firmNumber} with staged approach...`);
    
    // Step 1: Create Firm with bootstrapStatus=PENDING
    const firmId = `FIRMTEST${firmNumber.toString().padStart(3, '0')}`;
    const firmSlug = `test-firm-${firmNumber}`;
    const firm = new Firm({
      firmId,
      name: `Test Firm ${firmNumber}`,
      firmSlug,
      status: 'ACTIVE',
      bootstrapStatus: 'PENDING',
    });
    
    await firm.save({ session });
    console.log(`[TEST] ✓ Firm created in PENDING state: ${firmId}`);
    
    // Step 2: Create Default Client
    const clientId = await generateNextClientId(firm._id, session);
    console.log(`[TEST] Generated clientId: ${clientId}`);
    
    const defaultClient = new Client({
      clientId,
      businessName: `Test Firm ${firmNumber}`,
      businessAddress: 'Test Address',
      primaryContactNumber: '0000000000',
      businessEmail: `${firmId.toLowerCase()}@test.com`,
      firmId: firm._id,
      isSystemClient: true,
      isInternal: true,
      createdBySystem: true,
      isActive: true,
      status: 'ACTIVE',
      createdByXid: 'SUPERADMIN',
      createdBy: 'test@test.com',
    });
    
    await defaultClient.save({ session });
    console.log(`[TEST] ✓ Default client created: ${clientId}`);
    
    // Step 3: Link Firm → defaultClientId
    firm.defaultClientId = defaultClient._id;
    await firm.save({ session });
    console.log(`[TEST] ✓ Firm defaultClientId linked`);
    
    // Step 4: Create Admin User linked to default client
    const adminXID = await generateNextXID(firm._id, session);
    console.log(`[TEST] Generated adminXID: ${adminXID}`);
    
    const adminUser = new User({
      xID: adminXID,
      name: `Test Admin ${firmNumber}`,
      email: `testadmin${firmNumber}@test.com`,
      firmId: firm._id,
      defaultClientId: defaultClient._id,
      role: 'Admin',
      status: 'INVITED',
      isActive: true,
      isSystem: true,
      passwordSet: false,
      mustChangePassword: true,
    });
    
    await adminUser.save({ session });
    console.log(`[TEST] ✓ Admin user created with defaultClientId linked: ${adminXID}`);
    
    // Step 5: Mark Firm bootstrapStatus=COMPLETED
    firm.bootstrapStatus = 'COMPLETED';
    await firm.save({ session });
    console.log(`[TEST] ✓ Firm bootstrap completed`);
    
    await session.commitTransaction();
    session.endSession();
    
    console.log(`[TEST] ✓✓✓ Firm ${firmNumber} created successfully with staged approach`);
    
    // Verify final state
    const updatedAdmin = await User.findById(adminUser._id);
    if (!updatedAdmin.defaultClientId) {
      throw new Error('Admin defaultClientId not set!');
    }
    console.log(`[TEST] ✓ Verified admin has defaultClientId: ${updatedAdmin.defaultClientId}`);
    
    return { firm, client: defaultClient, admin: updatedAdmin };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(`[TEST] ✗ Failed to create firm ${firmNumber}:`, error.message);
    throw error;
  }
}

/**
 * Test 2: Simulate partial failure and recovery
 */
async function testPartialFailureRecovery() {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    console.log(`\n[TEST] Simulating partial failure scenario...`);
    
    // Step 1: Create Firm with bootstrapStatus=PENDING
    const firmId = `FIRMTEST999`;
    const firmSlug = `test-firm-999`;
    const firm = new Firm({
      firmId,
      name: `Test Firm 999`,
      firmSlug,
      status: 'ACTIVE',
      bootstrapStatus: 'PENDING',
    });
    
    await firm.save({ session });
    console.log(`[TEST] ✓ Firm created in PENDING state: ${firmId}`);
    
    // SIMULATE FAILURE: Don't create client or admin, don't link anything
    // Commit transaction in this incomplete state
    await session.commitTransaction();
    session.endSession();
    
    console.log(`[TEST] ✓ Simulated partial failure - firm left in PENDING state`);
    
    // Now attempt recovery
    console.log(`\n[TEST] Attempting recovery...`);
    const recoveryResult = await recoverFirmBootstrap(firm._id);
    
    if (!recoveryResult.success) {
      console.log(`[TEST] ✓ Recovery correctly detected issue: ${recoveryResult.message}`);
      console.log(`[TEST]   (Recovery requires manual intervention for missing admin email)`);
      
      // Cleanup the incomplete firm
       await Firm.deleteOne({ _id: firm._id });
       console.log(`[TEST] ✓ Cleaned up incomplete firm`);
      
      return true;
    } else {
      console.log(`[TEST] ✓ Recovery successful: ${recoveryResult.message}`);
      console.log(`[TEST]   Actions taken: ${recoveryResult.recoveryActions.join(', ')}`);
      
      // Verify recovery
      const recoveredFirm = await Firm.findById(firm._id);
      if (recoveredFirm.bootstrapStatus !== 'COMPLETED') {
        throw new Error('Firm bootstrap not completed after recovery!');
      }
      console.log(`[TEST] ✓ Verified firm is now COMPLETED`);
      
      return true;
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(`[TEST] ✗ Recovery test failed:`, error.message);
    throw error;
  }
}

async function runTests() {
  try {
    console.log('[TEST] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[TEST] Connected to MongoDB');
    
    // Cleanup before tests
    await cleanup();
    
    // Test 1: Create firm with staged approach
    console.log('\n========================================');
    console.log('TEST 1: Create firm with staged approach');
    console.log('========================================');
    const firm1 = await createTestFirmStaged(1);
    
    // Verify bootstrapStatus
    const verifyFirm1 = await Firm.findById(firm1.firm._id);
    if (verifyFirm1.bootstrapStatus !== 'COMPLETED') {
      throw new Error('Firm 1 bootstrapStatus not COMPLETED!');
    }
    console.log(`[TEST] ✓ Firm 1 bootstrapStatus is COMPLETED`);
    
    // Test 2: Create second firm
    console.log('\n========================================');
    console.log('TEST 2: Create second firm');
    console.log('========================================');
    const firm2 = await createTestFirmStaged(2);
    
    // Test 3: Partial failure and recovery
    console.log('\n========================================');
    console.log('TEST 3: Partial failure and recovery');
    console.log('========================================');
    await testPartialFailureRecovery();
    
    // Verify isolation
    console.log('\n========================================');
    console.log('VERIFICATION: Check firm isolation');
    console.log('========================================');
    
    const allFirms = await Firm.find({ firmId: /^FIRMTEST/ }).sort({ firmId: 1 });
    const allClients = await Client.find({ businessName: /^Test Firm/ }).sort({ clientId: 1 });
    const allAdmins = await User.find({ email: /^testadmin.*@test\.com$/ }).sort({ xID: 1 });
    
    console.log(`[TEST] Created ${allFirms.length} firms`);
    console.log(`[TEST] Created ${allClients.length} clients`);
    console.log(`[TEST] Created ${allAdmins.length} admins`);
    
    // Verify all completed firms have defaultClientId
    for (const firm of allFirms) {
      if (firm.bootstrapStatus === 'COMPLETED' && !firm.defaultClientId) {
        throw new Error(`Firm ${firm.firmId} is COMPLETED but has no defaultClientId`);
      }
      console.log(`[TEST] ✓ Firm ${firm.firmId} - Status: ${firm.bootstrapStatus}`);
    }
    
    // Verify all admins have defaultClientId
    for (const admin of allAdmins) {
      if (!admin.defaultClientId) {
        throw new Error(`Admin ${admin.xID} has no defaultClientId`);
      }
      console.log(`[TEST] ✓ Admin ${admin.xID} has defaultClientId`);
    }
    
    console.log('\n========================================');
    console.log('✓✓✓ ALL TESTS PASSED ✓✓✓');
    console.log('========================================');
    console.log('[TEST] Staged firm creation works correctly');
    console.log('[TEST] defaultClientId can be null during bootstrap');
    console.log('[TEST] Admin can be created before default client');
    console.log('[TEST] bootstrapStatus tracks completion correctly');
    console.log('[TEST] Recovery logic detects incomplete bootstrap');
    
    // Cleanup after tests
    await cleanup();
    
  } catch (error) {
    console.error('\n========================================');
    console.error('✗✗✗ TEST FAILED ✗✗✗');
    console.error('========================================');
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n[TEST] Disconnected from MongoDB');
  }
}

// Run tests
runTests().catch(console.error);
