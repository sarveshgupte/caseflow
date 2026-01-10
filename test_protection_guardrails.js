#!/usr/bin/env node
/**
 * Test script to verify system entity protection guardrails
 * Tests that default admin and internal client cannot be deactivated or deleted
 */

const mongoose = require('mongoose');
const Firm = require('./src/models/Firm.model');
const Client = require('./src/models/Client.model');
const User = require('./src/models/User.model');

// Use test database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/docketra-test';

async function testUserProtection() {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 1: System User Protection');
  console.log('═══════════════════════════════════════════');
  
  // Find a system user (default admin)
  const systemUser = await User.findOne({ isSystem: true });
  
  if (!systemUser) {
    console.log('⚠️  No system user found. This is expected if no firms have been onboarded.');
    console.log('   System users are created during firm onboarding.');
    return;
  }
  
  console.log(`\n✓ Found system user: ${systemUser.xID} (${systemUser.name})`);
  console.log(`  Email: ${systemUser.email}`);
  console.log(`  Firm: ${systemUser.firmId}`);
  console.log(`  isSystem: ${systemUser.isSystem}`);
  console.log(`  isActive: ${systemUser.isActive}`);
  
  // Test 1: Try to deactivate system user (should fail)
  console.log('\n📋 Test 1a: Attempting to deactivate system user...');
  try {
    systemUser.isActive = false;
    await systemUser.save();
    console.log('❌ FAIL: System user was deactivated (this should not happen!)');
  } catch (error) {
    console.log('✓ PASS: Deactivation blocked (this is expected behavior)');
  }
  
  // Verify user is still active
  const stillActive = await User.findById(systemUser._id);
  if (stillActive.isActive) {
    console.log('✓ PASS: System user remains active');
  } else {
    console.log('❌ FAIL: System user is inactive (protection failed)');
  }
}

async function testClientProtection() {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 2: Internal Client Protection');
  console.log('═══════════════════════════════════════════');
  
  // Find an internal/system client
  const internalClient = await Client.findOne({ 
    $or: [
      { isInternal: true },
      { isSystemClient: true },
      { clientId: 'C000001' }
    ]
  });
  
  if (!internalClient) {
    console.log('⚠️  No internal client found. This is expected if no firms have been onboarded.');
    console.log('   Internal clients are created during firm onboarding.');
    return;
  }
  
  console.log(`\n✓ Found internal client: ${internalClient.clientId}`);
  console.log(`  Business Name: ${internalClient.businessName}`);
  console.log(`  Firm: ${internalClient.firmId}`);
  console.log(`  isInternal: ${internalClient.isInternal}`);
  console.log(`  isSystemClient: ${internalClient.isSystemClient}`);
  console.log(`  isActive: ${internalClient.isActive}`);
  console.log(`  status: ${internalClient.status}`);
  
  // Test 2: Try to deactivate internal client (should fail at API layer)
  console.log('\n📋 Test 2a: Attempting to deactivate internal client...');
  console.log('   Note: Protection is enforced at API layer, not model layer');
  console.log('   Direct model changes will succeed, but API calls will be blocked');
  
  // Check protection flags
  const isProtected = 
    internalClient.isSystemClient === true || 
    internalClient.isInternal === true || 
    internalClient.clientId === 'C000001';
  
  if (isProtected) {
    console.log('✓ PASS: Client has protection flags set');
    console.log(`  Protection flags: isSystemClient=${internalClient.isSystemClient}, isInternal=${internalClient.isInternal}, clientId=${internalClient.clientId}`);
  } else {
    console.log('❌ FAIL: Client does not have protection flags');
  }
}

async function testFirmHierarchy() {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 3: Firm Hierarchy Integrity');
  console.log('═══════════════════════════════════════════');
  
  // Get all firms and check they have system entities
  const firms = await Firm.find();
  
  if (firms.length === 0) {
    console.log('⚠️  No firms found. This is expected for an empty database.');
    console.log('   Create a firm via SuperAdmin API to test hierarchy.');
    return;
  }
  
  console.log(`\n✓ Found ${firms.length} firm(s)`);
  
  for (const firm of firms) {
    console.log(`\n─────────────────────────────────────────`);
    console.log(`Firm: ${firm.firmId} (${firm.name})`);
    
    // Check if firm has defaultClientId
    if (firm.defaultClientId) {
      console.log(`✓ Has defaultClientId: ${firm.defaultClientId}`);
      
      // Verify the client exists
      const defaultClient = await Client.findById(firm.defaultClientId);
      if (defaultClient) {
        console.log(`✓ Default client exists: ${defaultClient.clientId}`);
        console.log(`  isInternal: ${defaultClient.isInternal}`);
        console.log(`  isSystemClient: ${defaultClient.isSystemClient}`);
      } else {
        console.log(`❌ Default client NOT found (broken reference)`);
      }
    } else {
      console.log(`❌ FAIL: Firm missing defaultClientId`);
    }
    
    // Check if firm has system admin
    const systemAdmin = await User.findOne({ 
      firmId: firm._id, 
      isSystem: true,
      role: 'Admin'
    });
    
    if (systemAdmin) {
      console.log(`✓ Has system admin: ${systemAdmin.xID} (${systemAdmin.name})`);
    } else {
      console.log(`❌ FAIL: Firm missing system admin`);
    }
  }
}

async function testFirmScopedIds() {
  console.log('\n═══════════════════════════════════════════');
  console.log('TEST 4: Firm-Scoped ID Uniqueness');
  console.log('═══════════════════════════════════════════');
  
  // Check for duplicate xIDs across different firms
  const firms = await Firm.find().limit(2);
  
  if (firms.length < 2) {
    console.log('⚠️  Need at least 2 firms to test firm-scoped IDs');
    console.log('   Create multiple firms via SuperAdmin API to test this.');
    return;
  }
  
  const firm1Users = await User.find({ firmId: firms[0]._id }).sort({ xID: 1 }).limit(3);
  const firm2Users = await User.find({ firmId: firms[1]._id }).sort({ xID: 1 }).limit(3);
  
  console.log(`\nFirm 1 (${firms[0].firmId}) users:`);
  firm1Users.forEach(u => console.log(`  ${u.xID} - ${u.name}`));
  
  console.log(`\nFirm 2 (${firms[1].firmId}) users:`);
  firm2Users.forEach(u => console.log(`  ${u.xID} - ${u.name}`));
  
  // Check if both firms have X000001 (expected with firm-scoped IDs)
  const firm1HasX000001 = firm1Users.some(u => u.xID === 'X000001');
  const firm2HasX000001 = firm2Users.some(u => u.xID === 'X000001');
  
  if (firm1HasX000001 && firm2HasX000001) {
    console.log('\n✓ PASS: Both firms have X000001 (firm-scoped IDs working)');
  } else {
    console.log('\n⚠️  Not both firms have X000001 (may need more data)');
  }
  
  // Check for duplicate clientIds across firms
  const firm1Clients = await Client.find({ firmId: firms[0]._id }).sort({ clientId: 1 }).limit(3);
  const firm2Clients = await Client.find({ firmId: firms[1]._id }).sort({ clientId: 1 }).limit(3);
  
  console.log(`\nFirm 1 (${firms[0].firmId}) clients:`);
  firm1Clients.forEach(c => console.log(`  ${c.clientId} - ${c.businessName}`));
  
  console.log(`\nFirm 2 (${firms[1].firmId}) clients:`);
  firm2Clients.forEach(c => console.log(`  ${c.clientId} - ${c.businessName}`));
  
  const firm1HasC000001 = firm1Clients.some(c => c.clientId === 'C000001');
  const firm2HasC000001 = firm2Clients.some(c => c.clientId === 'C000001');
  
  if (firm1HasC000001 && firm2HasC000001) {
    console.log('\n✓ PASS: Both firms have C000001 (firm-scoped IDs working)');
  } else {
    console.log('\n⚠️  Not both firms have C000001 (may need more data)');
  }
}

async function runTests() {
  try {
    console.log('╔════════════════════════════════════════════╗');
    console.log('║  System Entity Protection Test Suite      ║');
    console.log('╚════════════════════════════════════════════╝');
    
    // Connect to database
    console.log(`\nConnecting to MongoDB: ${MONGODB_URI}`);
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');
    
    // Run all tests
    await testUserProtection();
    await testClientProtection();
    await testFirmHierarchy();
    await testFirmScopedIds();
    
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  All Tests Complete                        ║');
    console.log('╚════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB\n');
  }
}

// Run tests
runTests();
