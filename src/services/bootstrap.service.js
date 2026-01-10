/**
 * Bootstrap Service for Docketra
 * 
 * Automatically ensures required system entities exist on startup:
 * 1. Superadmin - platform operator (from env vars)
 * 2. System Admin (X000001) - for first-run usability (legacy)
 * 3. Default Client (C000001) - for case creation
 * 
 * Features:
 * - Runs automatically on server startup (after MongoDB connection)
 * - Idempotent - safe to run multiple times
 * - Does NOT overwrite existing entities
 * - Preserves audit trail
 * - No manual MongoDB setup required
 */

const User = require('../models/User.model');
const Client = require('../models/Client.model');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Seed Superadmin from environment variables
 * 
 * Creates the Superadmin user if none exists with role SUPER_ADMIN.
 * Uses SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD from environment.
 * 
 * Superadmin properties:
 * - email: from SUPERADMIN_EMAIL env var
 * - password: from SUPERADMIN_PASSWORD env var (hashed)
 * - role: SUPER_ADMIN
 * - firmId: null (platform-level access)
 * - isActive: true
 * - status: ACTIVE
 * - passwordSet: true (allows immediate login)
 * - mustChangePassword: false (allows full system access)
 */
const seedSuperadmin = async () => {
  try {
    // Check for required env vars
    const superadminEmail = process.env.SUPERADMIN_EMAIL;
    const superadminPassword = process.env.SUPERADMIN_PASSWORD;
    
    if (!superadminEmail || !superadminPassword) {
      console.log('⚠️  SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD not set - skipping Superadmin creation');
      return;
    }
    
    // Check if Superadmin already exists
    const existingSuperadmin = await User.findOne({ role: 'SUPER_ADMIN' });
    
    if (existingSuperadmin) {
      console.log('✓ Superadmin already exists (email: ' + existingSuperadmin.email + ')');
      return;
    }
    
    // Hash the password
    const passwordHash = await bcrypt.hash(superadminPassword, SALT_ROUNDS);
    
    // Create Superadmin
    const superadmin = new User({
      xID: 'SUPERADMIN', // Special xID for Superadmin
      name: 'Platform Superadmin',
      email: superadminEmail,
      role: 'SUPER_ADMIN',
      firmId: null, // No firm - platform-level access
      status: 'ACTIVE',
      passwordHash,
      passwordSet: true, // Allow immediate login
      mustChangePassword: false, // Allow full system access
      passwordLastChangedAt: new Date(),
      passwordExpiresAt: new Date('2099-12-31T23:59:59.999Z'), // Far future date
      isActive: true,
    });
    
    await superadmin.save();
    console.log('✓ Superadmin created successfully');
    console.log('  Email: ' + superadminEmail);
    console.log('  ⚠️  Please secure your SUPERADMIN_PASSWORD environment variable');
  } catch (error) {
    console.error('✗ Error seeding Superadmin:', error.message);
    throw error;
  }
};

/**
 * Seed System Admin (X000001)
 * 
 * Creates the system admin user if none exists.
 * Checks for existing user with xID = "X000001" OR role = "Admin"
 * 
 * System Admin properties:
 * - xID: X000001
 * - name: System Admin
 * - email: admin@system.local
 * - role: Admin
 * - status: ACTIVE
 * - password: Default password (ChangeMe@123) - should be changed after first login
 * - passwordSet: true (allows immediate login)
 * - mustChangePassword: false (allows full system access without forced password change)
 * - passwordExpiresAt: far future (2099)
 * - isActive: true
 * - createdByXid: SYSTEM
 * - firmId: Required - will use first available firm or create default firm
 */
const seedSystemAdmin = async () => {
  try {
    const DEFAULT_PASSWORD = 'ChangeMe@123';
    
    // Check if admin already exists (by xID or by role)
    const existingAdmin = await User.findOne({
      $or: [
        { xID: 'X000001' },
        { role: 'Admin' }
      ]
    });

    if (existingAdmin) {
      console.log('✓ System Admin already exists (xID: ' + existingAdmin.xID + ')');
      return;
    }
    
    // Get or create a default firm for the admin
    const Firm = require('../models/Firm.model');
    let defaultFirm = await Firm.findOne({ firmId: 'FIRM001' });
    
    if (!defaultFirm) {
      defaultFirm = new Firm({
        firmId: 'FIRM001',
        name: 'Default Firm',
        status: 'ACTIVE',
      });
      await defaultFirm.save();
      console.log('✓ Default Firm created (firmId: FIRM001)');
    }

    // Hash the default password
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    // Create System Admin with default password for immediate usability
    const systemAdmin = new User({
      xID: 'X000001',
      name: 'System Admin',
      email: 'admin@system.local',
      role: 'Admin',
      firmId: defaultFirm._id,
      status: 'ACTIVE',
      passwordHash,
      passwordSet: true, // Allow immediate login
      mustChangePassword: false, // Allow full system access - admin can change password later
      passwordLastChangedAt: new Date(),
      passwordExpiresAt: new Date('2099-12-31T23:59:59.999Z'), // Far future date
      isActive: true,
    });

    await systemAdmin.save();
    console.log('✓ System Admin created successfully (xID: X000001)');
    console.log('  Default Password: ' + DEFAULT_PASSWORD);
    console.log('  ⚠️  Please change the default password after first login');
  } catch (error) {
    console.error('✗ Error seeding System Admin:', error.message);
    throw error;
  }
};

/**
 * Seed Default Client (C000001)
 * 
 * Creates the default client if it doesn't exist.
 * Validates that default organization exists first.
 * 
 * Default Client properties:
 * - clientId: C000001
 * - businessName: Default Client
 * - isActive: true
 * - isSystemClient: true
 * - createdByXid: SYSTEM (canonical identifier)
 * - createdBy: system@system.local (deprecated, for backward compatibility)
 */
const seedDefaultClient = async () => {
  try {
    // Check if default client already exists
    const existingClient = await Client.findOne({ clientId: 'C000001' });

    if (existingClient) {
      console.log('✓ Default Client already exists (clientId: C000001)');
      return;
    }

    // Create Default Client
    const defaultClient = new Client({
      clientId: 'C000001',
      businessName: 'Default Client',
      businessAddress: 'System Default Address',
      primaryContactNumber: '0000000000',
      businessEmail: 'default@system.local',
      isSystemClient: true,
      isActive: true,
      status: 'ACTIVE',
      createdByXid: 'SYSTEM', // CANONICAL - system-generated identifier
      createdBy: 'system@system.local', // DEPRECATED - backward compatibility only
    });

    await defaultClient.save();
    console.log('✓ Default Client created successfully (clientId: C000001)');
  } catch (error) {
    console.error('✗ Error seeding Default Client:', error.message);
    console.error('Stack trace:', error.stack);
    throw error;
  }
};

/**
 * Run all bootstrap operations
 * 
 * This function is called on server startup after MongoDB connection.
 * It ensures all required system entities exist.
 * 
 * Order matters:
 * 1. Superadmin first (platform-level control)
 * 2. System Admin second (for administrative access)
 * 3. Default Client third (for case creation)
 */
const runBootstrap = async () => {
  try {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  Running Bootstrap Checks...               ║');
    console.log('╚════════════════════════════════════════════╝\n');

    // Seed Superadmin
    await seedSuperadmin();

    // Seed System Admin
    await seedSystemAdmin();

    // Seed Default Client
    await seedDefaultClient();

    console.log('\n✓ Bootstrap completed successfully\n');
  } catch (error) {
    console.error('\n✗ Bootstrap failed:', error.message);
    // Don't exit process - let server continue but log the error
    // This allows investigation without blocking startup
    console.error('⚠️  Warning: System may not be fully functional without bootstrap data');
  }
};

module.exports = {
  runBootstrap,
  seedSuperadmin,
  seedSystemAdmin,
  seedDefaultClient,
};
