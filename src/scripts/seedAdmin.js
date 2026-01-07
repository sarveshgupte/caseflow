/**
 * Seed Admin Script for Docketra
 * 
 * Purpose: Creates the first Admin user for the Docketra case management system
 * 
 * Usage:
 *   1. Ensure MongoDB is running and MONGODB_URI is set in .env file
 *   2. Run: node src/scripts/seedAdmin.js
 *   3. The script will check if admin exists before creating to prevent duplicates
 * 
 * WARNING: This script uses a placeholder password ("admin123") for demonstration.
 *          Change this password immediately after first login in production.
 *          Implement proper password hashing with bcrypt before production use.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ MongoDB Connected');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@docketra.com' });
    
    if (existingAdmin) {
      console.log('ℹ Admin user already exists. Skipping creation.');
      console.log(`  Email: ${existingAdmin.email}`);
      console.log(`  Role: ${existingAdmin.role}`);
      console.log(`  Active: ${existingAdmin.isActive}`);
    } else {
      // Create the first Admin user
      const adminUser = new User({
        email: 'admin@docketra.com',
        password: 'admin123', // WARNING: Placeholder password - change in production
        role: 'Admin',
        allowedCategories: [],
        isActive: true,
      });

      await adminUser.save();
      console.log('✓ Admin user created successfully!');
      console.log(`  Email: ${adminUser.email}`);
      console.log(`  Role: ${adminUser.role}`);
      console.log(`  Active: ${adminUser.isActive}`);
      console.log('\n⚠ WARNING: Please change the default password immediately!');
    }

  } catch (error) {
    console.error('✗ Error seeding admin user:', error.message);
    process.exit(1);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
    process.exit(0);
  }
};

// Run the seed script
seedAdmin();
