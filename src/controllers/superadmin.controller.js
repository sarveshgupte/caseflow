const User = require('../models/User.model');
const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const SuperadminAudit = require('../models/SuperadminAudit.model');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const emailService = require('../services/email.service');
const mongoose = require('mongoose');
const { generateNextClientId } = require('../services/clientIdGenerator');

const SALT_ROUNDS = 10;

/**
 * Log Superadmin action to audit log
 */
const logSuperadminAction = async ({ actionType, description, performedBy, performedById, targetEntityType, targetEntityId, metadata = {}, req }) => {
  try {
    await SuperadminAudit.create({
      actionType,
      description,
      performedBy,
      performedById,
      targetEntityType,
      targetEntityId,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
      metadata,
    });
  } catch (error) {
    console.error('[SUPERADMIN_AUDIT] Failed to log action:', error.message);
    // Don't throw - audit failures shouldn't block the request
  }
};

/**
 * Create a new firm with transactional guarantees
 * POST /api/superadmin/firms
 * 
 * Atomically creates (ONE TRANSACTION):
 * 1. Firm
 * 2. Default Client (represents the firm, isSystemClient=true)
 * 3. Default Admin User (assigned to firm and default client)
 * 4. Links everything: Firm.defaultClientId, Admin.firmId, Admin.defaultClientId
 * 
 * If any step fails, all changes are rolled back.
 * This ensures a firm never exists without its default client and admin.
 * 
 * Sends Tier-1 emails:
 * - Firm Created SUCCESS to SuperAdmin
 * - Default Admin Created to Admin email
 * - Firm Creation FAILED to SuperAdmin (on error)
 */
const createFirm = async (req, res) => {
  // Start a session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { name, adminName, adminEmail } = req.body;
    
    // Validate required fields
    if (!name || !name.trim()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Firm name is required',
      });
    }
    
    if (!adminName || !adminName.trim()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Admin name is required',
      });
    }
    
    if (!adminEmail || !adminEmail.trim()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Admin email is required',
      });
    }
    
    // Validate email format
    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(adminEmail)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Invalid admin email format',
      });
    }
    
    // Check if admin email already exists
    const existingUser = await User.findOne({ email: adminEmail.toLowerCase() }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }
    
    console.log(`[FIRM_CREATE] Starting atomic transaction for firm: ${name}`);
    
    // ============================================================
    // STEP 1: Generate Firm ID and Create Firm
    // ============================================================
    // Query latest firm within transaction to generate next ID
    // Bootstrap-safe: returns FIRM001 when no firms exist
    const lastFirm = await Firm.findOne({}, {}, { session }).sort({ createdAt: -1 });
    let firmNumber = 1;
    if (lastFirm && lastFirm.firmId) {
      const match = lastFirm.firmId.match(/FIRM(\d+)/);
      if (match) {
        firmNumber = parseInt(match[1], 10) + 1;
      }
    }
    const firmId = `FIRM${firmNumber.toString().padStart(3, '0')}`;
    
    const firm = new Firm({
      firmId,
      name: name.trim(),
      status: 'ACTIVE',
    });
    
    // ============================================================
    // STEP 2: Generate Client ID and Create Default Client
    // ============================================================
    // Pass firm ObjectId for transactional ID generation
    // Bootstrap-safe: returns C000001 when no clients exist
    
    // GUARDRAIL: Check if firm already has an internal client
    const existingInternalClient = await Client.findOne({ 
      firmId: firm._id, 
      isInternal: true 
    }).session(session);
    
    if (existingInternalClient) {
      await session.abortTransaction();
      session.endSession();
      console.error(`[FIRM_CREATE] Firm ${firmId} already has an internal client: ${existingInternalClient.clientId}`);
      return res.status(409).json({
        success: false,
        message: 'Firm already has an internal client',
        existingClientId: existingInternalClient.clientId,
      });
    }
    
    const clientId = await generateNextClientId(firm._id, session);
    
    const defaultClient = new Client({
      clientId,
      businessName: name.trim(), // Use firm name as business name
      businessAddress: 'Default Address',
      primaryContactNumber: '0000000000',
      businessEmail: `${firmId.toLowerCase()}@system.local`,
      firmId: firm._id, // Link to firm
      isSystemClient: true, // Mark as system client
      isInternal: true,
      createdBySystem: true,
      isActive: true,
      status: 'ACTIVE',
      createdByXid: 'SUPERADMIN', // System-generated by SuperAdmin
      createdBy: process.env.SUPERADMIN_EMAIL || 'superadmin@system.local',
    });
    
    await defaultClient.save({ session });
    console.log(`[FIRM_CREATE] Internal client created for firm ${firm._id}`);
    console.log(`[FIRM_CREATE] ✓ Default client created: ${clientId}`);
    
    // ============================================================
    // STEP 3: Persist Firm with defaultClientId linkage
    // ============================================================
    firm.defaultClientId = defaultClient._id;
    await firm.save({ session });
    console.log(`[FIRM_CREATE] defaultClientId linked: ${defaultClient._id}`);
    console.log(`[FIRM_CREATE] ✓ Firm created: ${firmId}`);
    
    // ============================================================
    // STEP 4: Generate xID and Create Default Admin User
    // ============================================================
    // Pass firm ObjectId for transactional ID generation
    // Bootstrap-safe: returns X000001 when no users exist
    const xIDGenerator = require('../services/xIDGenerator');
    const adminXID = await xIDGenerator.generateNextXID(firm._id, session);
    
    // Generate password setup token
    const crypto = require('crypto');
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenHash = crypto.createHash('sha256').update(setupToken).digest('hex');
    const setupExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    
    const adminUser = new User({
      xID: adminXID,
      name: adminName.trim(),
      email: adminEmail.toLowerCase(),
      firmId: firm._id, // Link to firm
      defaultClientId: defaultClient._id, // Link to firm's default client
      role: 'Admin',
      status: 'INVITED',
      isActive: true,
      passwordSet: false,
      mustChangePassword: true,
      passwordSetupTokenHash: setupTokenHash,
      passwordSetupExpires: setupExpires,
      inviteSentAt: new Date(),
    });
    
    await adminUser.save({ session });
    console.log(`[FIRM_CREATE] ✓ Default admin created: ${adminXID}`);
    
    // ============================================================
    // COMMIT TRANSACTION
    // ============================================================
    await session.commitTransaction();
    session.endSession();
    
    console.log(`[FIRM_CREATE] ✓✓✓ Transaction committed successfully for ${firmId}`);
    
    // ============================================================
    // SEND TIER-1 EMAILS (OUTSIDE TRANSACTION)
    // ============================================================
    
    // Email 1: Firm Created SUCCESS to SuperAdmin
    try {
      const superadminEmail = process.env.SUPERADMIN_EMAIL;
      if (superadminEmail) {
        await emailService.sendFirmCreatedEmail(superadminEmail, {
          firmId,
          firmName: name.trim(),
          defaultClientId: clientId,
          adminXID,
          adminEmail: adminEmail.toLowerCase(),
        });
        console.log(`[FIRM_CREATE] ✓ Firm created email sent to SuperAdmin`);
      }
    } catch (emailError) {
      console.error('[FIRM_CREATE] Failed to send firm created email:', emailError.message);
      // Continue - email failure should not block the operation
    }
    
    // Email 2: Default Admin Created to Admin
    try {
      await emailService.sendPasswordSetupEmail(
        adminEmail.toLowerCase(),
        adminName.trim(),
        setupToken,
        adminXID
      );
      console.log(`[FIRM_CREATE] ✓ Admin invite email sent to ${adminEmail}`);
    } catch (emailError) {
      console.error('[FIRM_CREATE] Failed to send admin invite email:', emailError.message);
      // Continue - email failure should not block the operation
    }
    
    // Log action (outside transaction)
    await logSuperadminAction({
      actionType: 'FirmCreated',
      description: `Firm created: ${name} (${firmId}) with default client (${clientId}) and admin (${adminXID})`,
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'Firm',
      targetEntityId: firm._id.toString(),
      metadata: { 
        firmId, 
        name, 
        defaultClientId: clientId,
        adminXID,
        adminEmail: adminEmail.toLowerCase(),
      },
      req,
    });
    
    res.status(201).json({
      success: true,
      message: 'Firm created successfully with default client and admin. Admin credentials sent by email.',
      data: {
        firm: {
          _id: firm._id,
          firmId: firm.firmId,
          name: firm.name,
          status: firm.status,
          defaultClientId: firm.defaultClientId,
          createdAt: firm.createdAt,
        },
        defaultClient: {
          _id: defaultClient._id,
          clientId: defaultClient.clientId,
          businessName: defaultClient.businessName,
          isSystemClient: defaultClient.isSystemClient,
        },
        defaultAdmin: {
          _id: adminUser._id,
          xID: adminUser.xID,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          status: adminUser.status,
        },
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error('[SUPERADMIN] Error creating firm:', error);
    console.error('[SUPERADMIN] Transaction rolled back');
    
    // Determine failure step for detailed error reporting
    let failureStep = 'Unknown';
    if (error.message.includes('firmId') || error.message.includes('Firm')) {
      failureStep = 'Firm ID Generation or Creation';
    } else if (error.message.includes('clientId') || error.message.includes('Client')) {
      failureStep = 'Client ID Generation or Creation';
    } else if (error.message.includes('xID') || error.message.includes('User')) {
      failureStep = 'Admin User ID Generation or Creation';
    }
    
    // Send Tier-1 email: Firm Creation FAILED to SuperAdmin
    try {
      const superadminEmail = process.env.SUPERADMIN_EMAIL;
      if (superadminEmail) {
        await emailService.sendFirmCreationFailedEmail(superadminEmail, {
          firmName: req.body.name || 'Unknown',
          failureStep,
          errorMessage: error.message,
        });
        console.log(`[FIRM_CREATE] ✓ Firm creation failure email sent to SuperAdmin`);
      }
    } catch (emailError) {
      console.error('[FIRM_CREATE] Failed to send failure email:', emailError.message);
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create firm - transaction rolled back',
      error: error.message,
      failureStep,
    });
  }
};

/**
 * Get platform-level statistics
 * GET /api/superadmin/stats
 */
const getPlatformStats = async (req, res) => {
  try {
    // Get total firms
    const totalFirms = await Firm.countDocuments();
    const activeFirms = await Firm.countDocuments({ status: 'ACTIVE' });
    
    // Get total clients across all firms
    const totalClients = await Client.countDocuments();
    
    // Get total users across all firms (excluding SUPER_ADMIN)
    const totalUsers = await User.countDocuments({ role: { $ne: 'SuperAdmin' } });
    
    res.json({
      success: true,
      data: {
        totalFirms,
        activeFirms,
        inactiveFirms: totalFirms - activeFirms,
        totalClients,
        totalUsers,
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error getting platform stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get platform stats',
      error: error.message,
    });
  }
};

/**
 * List all firms with client and user counts
 * GET /api/superadmin/firms
 */
const listFirms = async (req, res) => {
  try {
    const firms = await Firm.find()
      .select('firmId name status createdAt')
      .sort({ createdAt: -1 });
    
    // Get counts for each firm
    const firmsWithCounts = await Promise.all(
      firms.map(async (firm) => {
        const clientCount = await Client.countDocuments({ firmId: firm._id });
        const userCount = await User.countDocuments({ firmId: firm._id });
        
        return {
          _id: firm._id,
          firmId: firm.firmId,
          name: firm.name,
          status: firm.status,
          isActive: firm.status === 'ACTIVE',
          clientCount,
          userCount,
          createdAt: firm.createdAt,
        };
      })
    );
    
    res.json({
      success: true,
      data: firmsWithCounts,
      count: firmsWithCounts.length,
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error listing firms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list firms',
      error: error.message,
    });
  }
};

/**
 * Update firm status (activate/suspend)
 * PATCH /api/superadmin/firms/:id
 */
const updateFirmStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['ACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be ACTIVE or SUSPENDED',
      });
    }
    
    const firm = await Firm.findById(id);
    
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }
    
    const oldStatus = firm.status;
    firm.status = status;
    await firm.save();
    
    // Log action
    const actionType = status === 'ACTIVE' ? 'FirmActivated' : 'FirmSuspended';
    await logSuperadminAction({
      actionType,
      description: `Firm ${status === 'ACTIVE' ? 'activated' : 'suspended'}: ${firm.name} (${firm.firmId})`,
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'Firm',
      targetEntityId: firm._id.toString(),
      metadata: { firmId: firm.firmId, name: firm.name, oldStatus, newStatus: status },
      req,
    });
    
    res.json({
      success: true,
      message: `Firm ${status === 'ACTIVE' ? 'activated' : 'suspended'} successfully`,
      data: {
        _id: firm._id,
        firmId: firm.firmId,
        name: firm.name,
        status: firm.status,
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error updating firm status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update firm status',
      error: error.message,
    });
  }
};

/**
 * Create firm admin
 * POST /api/superadmin/firms/:firmId/admin
 * 
 * Creates an Admin user for a firm with proper hierarchy:
 * - firmId: Links to the firm
 * - defaultClientId: Links to the firm's default client
 * 
 * The admin's defaultClientId MUST match the firm's defaultClientId.
 */
const createFirmAdmin = async (req, res) => {
  try {
    const { firmId } = req.params;
    const { name, email, xID } = req.body;
    
    // Validate required fields
    if (!name || !email || !xID) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and xID are required',
      });
    }
    
    // Normalize xID to uppercase
    const normalizedXID = xID.toUpperCase();
    
    // Validate xID format
    if (!/^X\d{6}$/.test(normalizedXID)) {
      return res.status(400).json({
        success: false,
        message: 'xID must be in format X123456',
      });
    }
    
    // Find firm by MongoDB _id and populate defaultClientId
    const firm = await Firm.findById(firmId);
    
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }
    
    // Ensure firm has a defaultClientId
    if (!firm.defaultClientId) {
      return res.status(400).json({
        success: false,
        message: 'Firm does not have a default client. Cannot create admin.',
      });
    }
    
    // Check if user with this xID already exists
    const existingUser = await User.findOne({ xID: normalizedXID });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this xID already exists',
      });
    }
    
    // Check if user with this email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }
    
    // Generate password setup token
    const setupToken = crypto.randomBytes(32).toString('hex');
    const setupTokenHash = crypto.createHash('sha256').update(setupToken).digest('hex');
    const setupExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    
    // Create admin user with firmId and defaultClientId
    const adminUser = new User({
      xID: normalizedXID,
      name,
      email: email.toLowerCase(),
      firmId: firm._id,
      defaultClientId: firm.defaultClientId, // Set to firm's default client
      role: 'Admin',
      status: 'INVITED',
      isActive: true,
      passwordSet: false,
      mustChangePassword: true,
      passwordSetupTokenHash: setupTokenHash,
      passwordSetupExpires: setupExpires,
      inviteSentAt: new Date(),
    });
    
    await adminUser.save();
    
    // Send password setup email
    try {
      await emailService.sendPasswordSetupEmail(adminUser.email, setupToken, adminUser.name);
    } catch (emailError) {
      console.error('[SUPERADMIN] Failed to send password setup email:', emailError);
      // Don't fail the request - admin was created successfully
    }
    
    // Log action
    await logSuperadminAction({
      actionType: 'FirmAdminCreated',
      description: `Firm admin created: ${name} (${xID}) for firm ${firm.name} (${firm.firmId})`,
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'User',
      targetEntityId: adminUser._id.toString(),
      metadata: { firmId: firm.firmId, firmName: firm.name, adminXID: xID, adminEmail: email },
      req,
    });
    
    res.status(201).json({
      success: true,
      message: 'Firm admin created successfully',
      data: {
        _id: adminUser._id,
        xID: adminUser.xID,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        status: adminUser.status,
        firm: {
          _id: firm._id,
          firmId: firm.firmId,
          name: firm.name,
        },
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error creating firm admin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create firm admin',
      error: error.message,
    });
  }
};

module.exports = {
  createFirm,
  listFirms,
  updateFirmStatus,
  createFirmAdmin,
  getPlatformStats,
};
