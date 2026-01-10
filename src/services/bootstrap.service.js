/**
 * Bootstrap Service for Docketra
 * 
 * Automatically ensures required system entities exist on startup:
 * 1. Default Firm (FIRM001)
 * 2. Default Client for Firm (represents the firm itself)
 * 3. System Admin (X000001) - assigned to default firm and client
 * 
 * NOTE: SuperAdmin is NOT stored in MongoDB - it exists ONLY in .env
 * SuperAdmin authentication is handled directly via environment variables.
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
 * Sends ONE email to SuperAdmin if violations exist (rate-limited per process start).
 * Does NOT block startup, only logs warnings.
 */
const runPreflightChecks = async () => {
  try {
    console.log('\n🔍 Running preflight data validation checks...');
    
    const violations = {};
    let hasViolations = false;
    
    // Check for firms without defaultClientId
    const firmsWithoutDefaultClient = await Firm.find({ 
      $or: [
        { defaultClientId: { $exists: false } },
        { defaultClientId: null }
      ]
    }).select('firmId name');
    
    if (firmsWithoutDefaultClient.length > 0) {
      hasViolations = true;
      violations.firmsWithoutDefaultClient = firmsWithoutDefaultClient.map(f => ({
        firmId: f.firmId,
        name: f.name
      }));
      console.warn(`⚠️  WARNING: Found ${firmsWithoutDefaultClient.length} firm(s) without defaultClientId:`);
      firmsWithoutDefaultClient.forEach(firm => {
        console.warn(`   - Firm: ${firm.firmId} (${firm.name})`);
      });
    }
    
    // Check for clients without firmId
    const clientsWithoutFirm = await Client.find({ 
      $or: [
        { firmId: { $exists: false } },
        { firmId: null }
      ]
    }).select('clientId businessName');
    
    if (clientsWithoutFirm.length > 0) {
      hasViolations = true;
      violations.clientsWithoutFirm = clientsWithoutFirm.map(c => ({
        clientId: c.clientId,
        businessName: c.businessName
      }));
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
        { firmId: null },
        { defaultClientId: { $exists: false } },
        { defaultClientId: null }
      ]
    }).select('xID name firmId defaultClientId');
    
    if (adminsWithoutFirm.length > 0) {
      hasViolations = true;
      violations.adminsWithoutFirmOrClient = adminsWithoutFirm.map(a => {
        const missing = [];
        if (!a.firmId) missing.push('firmId');
        if (!a.defaultClientId) missing.push('defaultClientId');
        return {
          xID: a.xID,
          name: a.name,
          missing
        };
      });
      console.warn(`⚠️  WARNING: Found ${adminsWithoutFirm.length} admin(s) without firmId or defaultClientId:`);
      adminsWithoutFirm.forEach(admin => {
        console.warn(`   - Admin: ${admin.xID} (${admin.name})`);
        if (!admin.firmId) console.warn(`     Missing: firmId`);
        if (!admin.defaultClientId) console.warn(`     Missing: defaultClientId`);
      });
    }
    
    // Send email if violations exist
    if (hasViolations) {
      console.warn('⚠️  Preflight checks found data inconsistencies (see warnings above)');
      console.warn('⚠️  These issues should be resolved through data migration');
      
      // Send Tier-1 email: System Integrity Warning (rate-limited per process start)
      const superadminEmail = process.env.SUPERADMIN_EMAIL;
      if (superadminEmail) {
        try {
          const emailService = require('./email.service');
          await emailService.sendSystemIntegrityEmail(superadminEmail, violations);
          console.log('✓ System integrity warning email sent to SuperAdmin');
        } catch (emailError) {
          console.error('✗ Failed to send integrity warning email:', emailError.message);
          // Don't throw - email failure should not block startup
        }
      } else {
        console.warn('⚠️  SUPERADMIN_EMAIL not configured - cannot send integrity warning email');
      }
    } else {
      console.log('✓ All preflight checks passed - data hierarchy is consistent');
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
 * 1. System Admin (creates Firm → Default Client → Admin hierarchy)
 * 2. Preflight checks (validates data consistency and sends email if violations exist)
 * 
 * NOTE: SuperAdmin is NOT seeded in MongoDB - it exists ONLY in .env
 * 
 * Bootstrap NEVER crashes the application - all errors are caught and logged.
 */
const runBootstrap = async () => {
  try {
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  Running Bootstrap Checks...               ║');
    console.log('╚════════════════════════════════════════════╝\n');

    // Seed System Admin (includes Firm and Default Client creation)
    // This creates the default firm hierarchy if none exists
    await seedSystemAdmin();

    // Run preflight data validation checks
    // Sends email to SuperAdmin if violations are found
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
  seedSystemAdmin,
  seedDefaultClient,
};
