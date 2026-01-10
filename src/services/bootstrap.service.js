/**
 * Bootstrap Service for Docketra
 * 
 * Automatically ensures required system entities exist on startup:
 * 1. Superadmin - platform operator (from env vars)
 * 2. Default Firm (FIRM001)
 * 3. Default Client for Firm (represents the firm itself)
 * 4. System Admin (X000001) - assigned to default firm and client
 * 
 * Features:
 * - Runs automatically on server startup (after MongoDB connection)
 * - Idempotent - safe to run multiple times
 * - Does NOT overwrite existing entities
 * - Preserves audit trail
 * - No manual MongoDB setup required
 * - NEVER crashes the application
 * 
 * Hierarchy enforced:
 * Firm → Default Client (isSystemClient=true) → Admin Users
 */

const User = require('../models/User.model');
const Client = require('../models/Client.model');
const Firm = require('../models/Firm.model');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Seed Superadmin from environment variables
 * 
 * Creates the Superadmin user if none exists with role SUPER_ADMIN.
 * Uses SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD from environment.
 * xID is normalized to uppercase.
 * 
 * Superadmin properties:
 * - xID: SUPERADMIN (normalized to uppercase)
 * - email: from SUPERADMIN_EMAIL env var
 * - password: from SUPERADMIN_PASSWORD env var (hashed)
 * - role: SUPER_ADMIN
 * - firmId: null (platform-level access)
 * - defaultClientId: null (platform-level access)
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
    
    // Create Superadmin with normalized xID
    const superadmin = new User({
      xID: 'SUPERADMIN', // Already uppercase
      name: 'Platform Superadmin',
      email: superadminEmail,
      role: 'SUPER_ADMIN',
      firmId: null, // No firm - platform-level access
      defaultClientId: null, // No default client - platform-level access
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
    // Don't throw - log warning but continue bootstrap
    console.warn('⚠️  Bootstrap will continue despite Superadmin creation failure');
  }
};

/**
 * Seed System Admin (X000001) and ensure Firm → Default Client → Admin hierarchy
 * 
 * Creates the system admin user if none exists.
 * Checks for existing user with xID = "X000001" OR role = "Admin"
 * 
 * Enforces hierarchy:
 * 1. Create/Get Default Firm (FIRM001)
 * 2. Create/Get Default Client for Firm (C000001, isSystemClient=true)
 * 3. Link Firm.defaultClientId to Default Client
 * 4. Create System Admin with firmId and defaultClientId
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
 * - firmId: Links to FIRM001
 * - defaultClientId: Links to firm's default client
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
      
      // Check if existing admin has required fields
      if (!existingAdmin.firmId) {
        console.warn('⚠️  WARNING: Existing admin missing firmId - data migration needed');
      }
      if (!existingAdmin.defaultClientId) {
        console.warn('⚠️  WARNING: Existing admin missing defaultClientId - data migration needed');
      }
      
      return;
    }
    
    // STEP 1: Get or create default firm (FIRM001)
    let defaultFirm = await Firm.findOne({ firmId: 'FIRM001' });
    
    if (!defaultFirm) {
      console.log('Creating Default Firm (FIRM001)...');
      defaultFirm = new Firm({
        firmId: 'FIRM001',
        name: 'Default Firm',
        status: 'ACTIVE',
      });
      await defaultFirm.save();
      console.log('✓ Default Firm created (firmId: FIRM001)');
    } else {
      console.log('✓ Default Firm exists (firmId: FIRM001)');
    }
    
    // STEP 2: Get or create default client for firm (C000001)
    let defaultClient = await Client.findOne({ clientId: 'C000001' });
    
    if (!defaultClient) {
      console.log('Creating Default Client (C000001)...');
      defaultClient = new Client({
        clientId: 'C000001',
        businessName: defaultFirm.name,
        businessAddress: 'System Default Address',
        primaryContactNumber: '0000000000',
        businessEmail: 'default@system.local',
        firmId: defaultFirm._id, // Link to firm
        isSystemClient: true,
        isActive: true,
        status: 'ACTIVE',
        createdByXid: 'SYSTEM', // CANONICAL - system-generated identifier
        createdBy: 'system@system.local', // DEPRECATED - backward compatibility only
      });
      await defaultClient.save();
      console.log('✓ Default Client created (clientId: C000001)');
    } else {
      console.log('✓ Default Client exists (clientId: C000001)');
      
      // Update client's firmId if not set
      if (!defaultClient.firmId) {
        console.log('Updating Default Client with firmId...');
        defaultClient.firmId = defaultFirm._id;
        await defaultClient.save();
        console.log('✓ Default Client updated with firmId');
      }
    }
    
    // STEP 3: Update firm with defaultClientId if not set
    if (!defaultFirm.defaultClientId) {
      console.log('Linking Firm to Default Client...');
      defaultFirm.defaultClientId = defaultClient._id;
      await defaultFirm.save();
      console.log('✓ Firm.defaultClientId set to Default Client');
    }

    // STEP 4: Hash the default password
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

    // STEP 5: Create System Admin with proper hierarchy
    const systemAdmin = new User({
      xID: 'X000001',
      name: 'System Admin',
      email: 'admin@system.local',
      role: 'Admin',
      firmId: defaultFirm._id, // Link to firm
      defaultClientId: defaultClient._id, // Link to firm's default client
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
    console.log('  Firm: ' + defaultFirm.firmId);
    console.log('  Default Client: ' + defaultClient.clientId);
    console.log('  ⚠️  Please change the default password after first login');
  } catch (error) {
    console.error('✗ Error seeding System Admin:', error.message);
    // Don't throw - log warning but continue bootstrap
    console.warn('⚠️  Bootstrap will continue despite System Admin creation failure');
  }
};

/**
 * Seed Default Client (C000001)
 * 
 * DEPRECATED: This function is now integrated into seedSystemAdmin
 * to ensure proper Firm → Default Client → Admin hierarchy.
 * Kept for backward compatibility but does nothing.
 */
const seedDefaultClient = async () => {
  // No-op: Default client creation is now handled in seedSystemAdmin
  // This ensures the proper hierarchy is always maintained
  console.log('✓ Default Client creation integrated into System Admin bootstrap');
};

/**
 * Run preflight data validation checks
 * 
 * Logs warnings for data inconsistencies that violate the hierarchy:
 * - Firms without defaultClientId
 * - Clients without firmId
 * - Admins without firmId or defaultClientId
 * 
 * Does NOT block startup, only logs warnings.
 */
const runPreflightChecks = async () => {
  try {
    console.log('\n🔍 Running preflight data validation checks...');
    
    // Check for firms without defaultClientId
    const firmsWithoutDefaultClient = await Firm.find({ defaultClientId: { $exists: false } });
    if (firmsWithoutDefaultClient.length > 0) {
      console.warn(`⚠️  WARNING: Found ${firmsWithoutDefaultClient.length} firm(s) without defaultClientId:`);
      firmsWithoutDefaultClient.forEach(firm => {
        console.warn(`   - Firm: ${firm.firmId} (${firm.name})`);
      });
    }
    
    // Check for clients without firmId
    const clientsWithoutFirm = await Client.find({ firmId: { $exists: false } });
    if (clientsWithoutFirm.length > 0) {
      console.warn(`⚠️  WARNING: Found ${clientsWithoutFirm.length} client(s) without firmId:`);
      clientsWithoutFirm.forEach(client => {
        console.warn(`   - Client: ${client.clientId} (${client.businessName})`);
      });
    }
    
    // Check for admins without firmId or defaultClientId
    const adminsWithoutFirm = await User.find({ 
      role: 'Admin',
      $or: [
        { firmId: { $exists: false } },
        { defaultClientId: { $exists: false } }
      ]
    });
    if (adminsWithoutFirm.length > 0) {
      console.warn(`⚠️  WARNING: Found ${adminsWithoutFirm.length} admin(s) without firmId or defaultClientId:`);
      adminsWithoutFirm.forEach(admin => {
        console.warn(`   - Admin: ${admin.xID} (${admin.name})`);
        if (!admin.firmId) console.warn(`     Missing: firmId`);
        if (!admin.defaultClientId) console.warn(`     Missing: defaultClientId`);
      });
    }
    
    if (firmsWithoutDefaultClient.length === 0 && 
        clientsWithoutFirm.length === 0 && 
        adminsWithoutFirm.length === 0) {
      console.log('✓ All preflight checks passed - data hierarchy is consistent');
    } else {
      console.warn('⚠️  Preflight checks found data inconsistencies (see warnings above)');
      console.warn('⚠️  These issues should be resolved through data migration');
    }
  } catch (error) {
    console.error('✗ Error running preflight checks:', error.message);
    // Don't throw - preflight checks should never block startup
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
 * 2. System Admin second (creates Firm → Default Client → Admin hierarchy)
 * 3. Preflight checks last (validates data consistency)
 * 
 * Bootstrap NEVER crashes the application - all errors are caught and logged.
 */
const runBootstrap = async () => {
  try {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  Running Bootstrap Checks...               ║');
    console.log('╚════════════════════════════════════════════╝\n');

    // Seed Superadmin
    await seedSuperadmin();

    // Seed System Admin (includes Firm and Default Client creation)
    await seedSystemAdmin();
    
    // No longer need separate default client seeding
    // It's integrated into seedSystemAdmin

    // Run preflight data validation checks
    await runPreflightChecks();

    console.log('\n✓ Bootstrap completed successfully\n');
  } catch (error) {
    console.error('\n✗ Bootstrap failed:', error.message);
    // Don't exit process - let server continue but log the error
    // This allows investigation without blocking startup
    console.error('⚠️  Warning: System may not be fully functional without bootstrap data');
    console.error('⚠️  Server will continue to run - please investigate and resolve bootstrap issues');
  }
};

module.exports = {
  runBootstrap,
  seedSuperadmin,
  seedSystemAdmin,
  seedDefaultClient,
};
