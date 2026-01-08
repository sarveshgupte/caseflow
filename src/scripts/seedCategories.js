/**
 * Seed Categories Script for Docketra
 * 
 * Purpose: Creates default system categories for the Docketra case management system
 * 
 * Usage:
 *   1. Ensure MongoDB is running and MONGODB_URI is set in .env file
 *   2. Run: node src/scripts/seedCategories.js
 *   3. The script will check if categories exist before creating to prevent duplicates
 * 
 * Default Categories:
 *   - Sales, Accounting, Expenses, Payroll, HR, Compliance
 *   - Core Business, Management Review
 *   - Client - New, Client - Edit
 *   - Internal
 * 
 * All seeded categories are marked as isSystem: true to prevent deletion
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category.model');

// Default system categories
const defaultCategories = [
  'Sales',
  'Accounting',
  'Expenses',
  'Payroll',
  'HR',
  'Compliance',
  'Core Business',
  'Management Review',
  'Client - New',
  'Client - Edit',
  'Client - Delete',
  'Internal',
];

const seedCategories = async () => {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ MongoDB Connected');

    let createdCount = 0;
    let skippedCount = 0;

    // Process each category
    for (const categoryName of defaultCategories) {
      // Check if category already exists
      const existingCategory = await Category.findOne({ name: categoryName });
      
      if (existingCategory) {
        console.log(`ℹ Category "${categoryName}" already exists. Skipping.`);
        skippedCount++;
      } else {
        // Create new system category
        const category = new Category({
          name: categoryName,
          isSystem: true,
          isActive: true,
        });

        await category.save();
        console.log(`✓ Created system category: "${categoryName}"`);
        createdCount++;
      }
    }

    // Summary
    console.log('\n--- Summary ---');
    console.log(`✓ Categories created: ${createdCount}`);
    console.log(`ℹ Categories skipped: ${skippedCount}`);
    console.log(`✓ Total categories processed: ${defaultCategories.length}`);

  } catch (error) {
    console.error('✗ Error seeding categories:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
    process.exit(0);
  }
};

// Run the seed script
seedCategories();
