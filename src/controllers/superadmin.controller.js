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
 * Atomically creates:
 * 1. Firm
 * 2. Default Client (represents the firm, isSystemClient=true)
 * 3. Links Firm.defaultClientId to the default client
 * 
 * If any step fails, all changes are rolled back.
 * This ensures a firm never exists without its default client.
 */
const createFirm = async (req, res) => {
  // Start a session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        message: 'Firm name is required',
      });
    }
    
    // Generate firmId (FIRM001, FIRM002, etc.)
    const lastFirm = await Firm.findOne().sort({ createdAt: -1 }).session(session);
    let firmNumber = 1;
    if (lastFirm && lastFirm.firmId) {
      const match = lastFirm.firmId.match(/FIRM(\d+)/);
      if (match) {
        firmNumber = parseInt(match[1], 10) + 1;
      }
    }
    const firmId = `FIRM${firmNumber.toString().padStart(3, '0')}`;
    
    // STEP 1: Create firm (without defaultClientId initially)
    const firm = new Firm({
      firmId,
      name: name.trim(),
      status: 'ACTIVE',
    });
    
    await firm.save({ session });
    console.log(`[FIRM_CREATE] Firm created: ${firmId}`);
    
    // STEP 2: Generate clientId for the default client
    const clientId = await generateNextClientId();
    
    // STEP 3: Create default client for the firm
    const defaultClient = new Client({
      clientId,
      businessName: name.trim(), // Use firm name as business name
      businessAddress: 'Default Address',
      primaryContactNumber: '0000000000',
      businessEmail: `${firmId.toLowerCase()}@system.local`,
      firmId: firm._id, // Link to firm
      isSystemClient: true, // Mark as system client
      isActive: true,
      status: 'ACTIVE',
      createdByXid: 'SYSTEM', // System-generated
      createdBy: 'system@system.local', // Deprecated field
    });
    
    await defaultClient.save({ session });
    console.log(`[FIRM_CREATE] Default client created: ${clientId}`);
    
    // STEP 4: Update firm with defaultClientId
    firm.defaultClientId = defaultClient._id;
    await firm.save({ session });
    console.log(`[FIRM_CREATE] Firm.defaultClientId set to ${clientId}`);
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    console.log(`[FIRM_CREATE] Transaction committed successfully for ${firmId}`);
    
    // Log action (outside transaction)
    await logSuperadminAction({
      actionType: 'FirmCreated',
      description: `Firm created: ${name} (${firmId}) with default client (${clientId})`,
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'Firm',
      targetEntityId: firm._id.toString(),
      metadata: { firmId, name, defaultClientId: clientId },
      req,
    });
    
    res.status(201).json({
      success: true,
      message: 'Firm created successfully with default client',
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
      },
    });
  } catch (error) {
    // Rollback transaction on error
    await session.abortTransaction();
    session.endSession();
    
    console.error('[SUPERADMIN] Error creating firm:', error);
    console.error('[SUPERADMIN] Transaction rolled back');
    
    res.status(500).json({
      success: false,
      message: 'Failed to create firm - transaction rolled back',
      error: error.message,
    });
  }
};

/**
 * List all firms
 * GET /api/superadmin/firms
 */
const listFirms = async (req, res) => {
  try {
    const firms = await Firm.find()
      .select('firmId name status createdAt')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: firms,
      count: firms.length,
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
};
