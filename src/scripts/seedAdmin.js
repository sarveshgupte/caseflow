/**
 * Seed Admin Script for Caseflow
 * 
 * Purpose: Creates the first Admin user for the Caseflow case management system
 * 
 * Usage:
 *   1. Ensure MongoDB is running and MONGODB_URI is set in .env file
 *   2. Run: node src/scripts/seedAdmin.js
 *   3. The script will check if admin exists before creating to prevent duplicates
 * 
 * Default Admin Credentials:
 *   xID: X000001
 *   Password: ChangeMe@123
 * 
 * ⚠️ WARNING: The default admin password is for first login only and must be 
 *             changed immediately after successful login.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../models/User.model');

const SALT_ROUNDS = 10;
const DEFAULT_PASSWORD = 'ChangeMe@123';
const PASSWORD_EXPIRY_DAYS = 60;
const ADMIN_XID = 'X000001';

const seedAdmin = async () => {
  try {
    // Check if seeding is enabled
    if (process.env.SEED_ADMIN !== 'true') {
      console.log('ℹ Admin seeding is disabled.');
      console.log('  To enable admin seeding, set SEED_ADMIN=true in your environment.');
      console.log('  This prevents accidental password resets on deploy.');
      return;
    }

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ MongoDB Connected');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ xID: ADMIN_XID });
    
    if (existingAdmin) {
      console.log('ℹ Admin user already exists. Updating password hash if needed...');
      console.log(`  xID: ${existingAdmin.xID}`);
      console.log(`  Name: ${existingAdmin.name}`);
      console.log(`  Role: ${existingAdmin.role}`);
      console.log(`  Active: ${existingAdmin.isActive}`);
      
      // Update password hash to ensure it's valid
      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
      existingAdmin.passwordHash = passwordHash;
      existingAdmin.mustChangePassword = true;
      existingAdmin.passwordLastChangedAt = new Date();
      existingAdmin.passwordExpiresAt = new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      
      await existingAdmin.save();
      console.log('✓ Admin password hash updated successfully!');
    } else {
      // Hash the default password
      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
      
      // Create the first Admin user with xID-based authentication
      const adminUser = new User({
        xID: ADMIN_XID,
        name: 'System Administrator',
        email: 'admin@caseflow.local',
        role: 'Admin',
        allowedCategories: [],
        isActive: true,
        passwordHash,
        mustChangePassword: true,
        passwordLastChangedAt: new Date(),
        passwordExpiresAt: new Date(Date.now() + PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
        passwordHistory: [],
      });

      await adminUser.save();
      console.log('✓ Admin user created successfully!');
      console.log(`  xID: ${adminUser.xID}`);
      console.log(`  Name: ${adminUser.name}`);
      console.log(`  Role: ${adminUser.role}`);
      console.log(`  Active: ${adminUser.isActive}`);
    }
    
    console.log('\n📋 Default Admin Credentials:');
    console.log(`   xID: ${ADMIN_XID}`);
    console.log(`   Password: ${DEFAULT_PASSWORD}`);
    console.log('\n⚠️  WARNING: Change the default password immediately after first login!');

  } catch (error) {
    console.error('✗ Error seeding admin user:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    // Close the database connection if connected
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('\n✓ Database connection closed');
    }
    process.exit(0);
  }
};

// Run the seed script
seedAdmin();
