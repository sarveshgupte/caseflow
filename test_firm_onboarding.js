#!/usr/bin/env node
/**
 * Test script to verify firm onboarding fix
 * Tests that multiple firms can be created successfully with firm-scoped IDs
 */

const mongoose = require('mongoose');
const Firm = require('./src/models/Firm.model');
const Client = require('./src/models/Client.model');
const User = require('./src/models/User.model');
const { generateNextClientId } = require('./src/services/clientIdGenerator');
const { generateNextXID } = require('./src/services/xIDGenerator');

// Use in-memory MongoDB for testing
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra-test';

async function cleanup() {
  console.log('[TEST] Cleaning up test data...');
  await Firm.deleteMany({ firmId: /^FIRMTEST/ });
  await Client.deleteMany({ businessName: /^Test Firm/ });
  await User.deleteMany({ email: /^testadmin.*@test\.com$/ });
  console.log('[TEST] Cleanup complete');
}

async function createTestFirm(firmNumber) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    console.log(`\n[TEST] Creating firm ${firmNumber}...`);
    
    // Step 1: Create Firm
    const firmId = `FIRMTEST${firmNumber.toString().padStart(3, '0')}`;
    const firm = new Firm({
      firmId,
      name: `Test Firm ${firmNumber}`,
      status: 'ACTIVE',
    });
    
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
      createdBy: 'superadmin@test.com',
    });
    
    await defaultClient.save({ session });
    console.log(`[TEST] Created default client: ${clientId}`);
    
    // Step 3: Link firm to default client
    firm.defaultClientId = defaultClient._id;
    await firm.save({ session });
    console.log(`[TEST] Linked firm ${firmId} to client ${clientId}`);
    
    // Step 4: Create Admin User
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
      passwordSet: false,
      mustChangePassword: true,
    });
    
    await adminUser.save({ session });
    console.log(`[TEST] Created admin user: ${adminXID}`);
    
    await session.commitTransaction();
    session.endSession();
    
    console.log(`[TEST] ✓ Firm ${firmNumber} created successfully`);
    console.log(`[TEST]   - Firm ID: ${firmId}`);
    console.log(`[TEST]   - Client ID: ${clientId}`);
    console.log(`[TEST]   - Admin xID: ${adminXID}`);
    
    return { firm, client: defaultClient, admin: adminUser };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(`[TEST] ✗ Failed to create firm ${firmNumber}:`, error.message);
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
    
    // Test 1: Create first firm
    console.log('\n========================================');
    console.log('TEST 1: Create first firm');
    console.log('========================================');
    const firm1 = await createTestFirm(1);
    
    // Test 2: Create second firm (this should not fail)
    console.log('\n========================================');
    console.log('TEST 2: Create second firm');
    console.log('========================================');
    const firm2 = await createTestFirm(2);
    
    // Test 3: Create third firm (ensure consistency)
    console.log('\n========================================');
    console.log('TEST 3: Create third firm');
    console.log('========================================');
    const firm3 = await createTestFirm(3);
    
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
    
    // Verify each firm has unique client ID
    const clientIds = allClients.map(c => c.clientId);
    const uniqueClientIds = new Set(clientIds);
    if (clientIds.length !== uniqueClientIds.size) {
      throw new Error('DUPLICATE CLIENT IDs DETECTED!');
    }
    console.log('[TEST] ✓ All client IDs are unique');
    
    // Verify each firm starts with C000001 (firm-scoped)
    for (const client of allClients) {
      if (client.clientId !== 'C000001') {
        throw new Error(`Client ${client._id} has unexpected ID: ${client.clientId} (expected C000001)`);
      }
    }
    console.log('[TEST] ✓ All firms start with C000001 (firm-scoped)');
    
    // Verify each admin starts with X000001 (firm-scoped)
    for (const admin of allAdmins) {
      if (admin.xID !== 'X000001') {
        throw new Error(`Admin ${admin._id} has unexpected ID: ${admin.xID} (expected X000001)`);
      }
    }
    console.log('[TEST] ✓ All firms start with X000001 (firm-scoped)');
    
    // Verify each firm is linked to its own client
    for (const firm of allFirms) {
      const client = allClients.find(c => c.firmId.toString() === firm._id.toString());
      if (!client) {
        throw new Error(`Firm ${firm.firmId} has no default client`);
      }
      if (firm.defaultClientId.toString() !== client._id.toString()) {
        throw new Error(`Firm ${firm.firmId} is not properly linked to its client`);
      }
      console.log(`[TEST] ✓ Firm ${firm.firmId} correctly linked to client ${client.clientId}`);
    }
    
    // Verify each admin is linked to correct firm and client
    for (const admin of allAdmins) {
      const firm = allFirms.find(f => f._id.toString() === admin.firmId.toString());
      if (!firm) {
        throw new Error(`Admin ${admin.xID} has no firm`);
      }
      if (admin.defaultClientId.toString() !== firm.defaultClientId.toString()) {
        throw new Error(`Admin ${admin.xID} is not linked to firm's default client`);
      }
      console.log(`[TEST] ✓ Admin ${admin.xID} correctly linked to firm ${firm.firmId}`);
    }
    
    console.log('\n========================================');
    console.log('✓✓✓ ALL TESTS PASSED ✓✓✓');
    console.log('========================================');
    console.log('[TEST] Multiple firms can be created successfully');
    console.log('[TEST] Each firm starts with C000001 (firm-scoped client IDs)');
    console.log('[TEST] Each firm starts with X000001 (firm-scoped user IDs)');
    console.log('[TEST] Each firm is properly isolated');
    
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
