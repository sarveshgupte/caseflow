/**
 * Seed Organization Client Script
 * 
 * Purpose: Creates the default system organization client (C000001)
 * This is a MANDATORY client that must always exist in the system.
 * 
 * Usage:
 *   1. Ensure MongoDB is running and MONGODB_URI is set in .env file
 *   2. Run: node src/scripts/seedOrganizationClient.js
 *   3. The script will check if organization client exists before creating
 * 
 * Organization Client Details:
 *   - clientId: C000001 (immutable, reserved)
 *   - businessName: Organization
 *   - isSystemClient: true (cannot be deleted or edited directly)
 *   - Used for internal/organization work
 * 
 * This client is created with system flag and cannot be tampered with.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Client = require('../models/Client.model');

const seedOrganizationClient = async () => {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ MongoDB Connected');

    // Check if organization client already exists
    const existingOrgClient = await Client.findOne({ clientId: 'C000001' });
    
    if (existingOrgClient) {
      console.log('ℹ Organization client (C000001) already exists.');
      console.log('  Business Name:', existingOrgClient.businessName);
      console.log('  System Client:', existingOrgClient.isSystemClient);
      console.log('  Created:', existingOrgClient.createdAt);
    } else {
      // Create the organization client
      const organizationClient = new Client({
        clientId: 'C000001',
        businessName: 'Organization',
        businessAddress: 'Organization Headquarters',
        businessPhone: '0000000000',
        businessEmail: 'organization@system.local',
        isSystemClient: true,
        isActive: true,
        createdBy: 'system@system.local',
      });

      await organizationClient.save();
      console.log('✓ Organization client created successfully!');
      console.log('  Client ID:', organizationClient.clientId);
      console.log('  Business Name:', organizationClient.businessName);
      console.log('  System Client:', organizationClient.isSystemClient);
      console.log('  Created By:', organizationClient.createdBy);
    }

    console.log('\n✓ Seed completed successfully');

  } catch (error) {
    console.error('✗ Error seeding organization client:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('✓ Database connection closed');
    process.exit(0);
  }
};

// Run the seed script
seedOrganizationClient();
