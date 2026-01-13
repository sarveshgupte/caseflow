const User = require('../models/User.model');
const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const SuperadminAudit = require('../models/SuperadminAudit.model');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const emailService = require('../services/email.service');
const mongoose = require('mongoose');
const { generateNextClientId } = require('../services/clientIdGenerator');
const { slugify } = require('../utils/slugify');
const { getDashboardSnapshot } = require('../utils/operationalMetrics');
const { wrapWriteHandler } = require('../utils/transactionGuards');

const { createFirmHierarchy, FirmBootstrapError } = require('../services/firmBootstrap.service');
const { isFirmCreationDisabled } = require('../services/featureFlags.service');

/**
 * Log Superadmin action to audit log
 * 
 * Supports both human-performed and system-triggered actions:
 * - For human actions: provide performedById as MongoDB ObjectId
 * - For system actions: performedById can be "SUPERADMIN" string or null, 
 *   and performedBySystem will be set to true automatically
 */
const logSuperadminAction = async ({ actionType, description, performedBy, performedById, targetEntityType, targetEntityId, metadata = {}, req }) => {
  try {
    // Determine if this is a system-triggered action
    // System actions are identified by:
    // 1. performedById is null/undefined
    // 2. performedById is the string "SUPERADMIN" (from auth middleware for SuperAdmin user)
    // 3. performedById is not a valid MongoDB ObjectId
    const isSystemAction = !performedById || 
                          performedById === 'SUPERADMIN' || 
                          (typeof performedById === 'string' && !mongoose.Types.ObjectId.isValid(performedById));
    
    // Build audit log entry
    const auditEntry = {
      actionType,
      description,
      performedBy,
      targetEntityType,
      targetEntityId,
      ipAddress: req?.ip,
      userAgent: req?.headers?.['user-agent'],
      metadata,
    };
    
    // Set system flag and performedById based on action type
    if (isSystemAction) {
      auditEntry.performedBySystem = true;
      auditEntry.performedById = null; // Don't pass invalid string to ObjectId field
    } else {
      auditEntry.performedById = performedById;
      auditEntry.performedBySystem = false;
    }
    
    await SuperadminAudit.create(auditEntry);
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
  const requestId = req.requestId || crypto.randomUUID();
  try {
    if (isFirmCreationDisabled()) {
      return res.status(503).json({
        success: false,
        message: 'Firm creation is temporarily disabled',
        requestId,
      });
    }

    const result = await createFirmHierarchy({
      payload: req.body,
      performedBy: req.user,
      requestId,
    });

    await logSuperadminAction({
      actionType: 'FirmCreated',
      description: `Firm created: ${result.firm.name} (${result.firm.firmId}, ${result.firm.firmSlug})`,
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'Firm',
      targetEntityId: result.firm._id.toString(),
      metadata: {
        firmId: result.firm.firmId,
        firmSlug: result.firm.firmSlug,
        defaultClientId: result.defaultClient._id,
        adminXID: result.adminUser.xID,
      },
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'Firm created successfully with default client and admin. Admin credentials sent by email.',
      data: {
        firm: {
          _id: result.firm._id,
          firmId: result.firm.firmId,
          firmSlug: result.firm.firmSlug,
          name: result.firm.name,
          status: result.firm.status,
          bootstrapStatus: result.firm.bootstrapStatus,
          defaultClientId: result.firm.defaultClientId,
          createdAt: result.firm.createdAt,
        },
        defaultClient: {
          _id: result.defaultClient._id,
          clientId: result.defaultClient.clientId,
          businessName: result.defaultClient.businessName,
          isSystemClient: result.defaultClient.isSystemClient,
        },
        defaultAdmin: {
          _id: result.adminUser._id,
          xID: result.adminUser.xID,
          name: result.adminUser.name,
          email: result.adminUser.email,
          role: result.adminUser.role,
          status: result.adminUser.status,
          defaultClientId: result.adminUser.defaultClientId,
        },
      },
      requestId,
    });
  } catch (error) {
    if (error instanceof FirmBootstrapError && error.statusCode === 200 && error.meta?.idempotent) {
      const firm = error.meta.firm;
      return res.status(200).json({
        success: true,
        message: 'Firm already exists',
        data: {
          firm: {
            _id: firm._id,
            firmId: firm.firmId,
            firmSlug: firm.firmSlug,
            name: firm.name,
            status: firm.status,
            bootstrapStatus: firm.bootstrapStatus,
            defaultClientId: firm.defaultClientId,
            createdAt: firm.createdAt,
          },
        },
        idempotent: true,
        requestId,
      });
    }

    if (error instanceof FirmBootstrapError) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message,
        requestId,
        ...(error.meta || {}),
      });
    }

    console.error('[SUPERADMIN] Error creating firm:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create firm - transaction rolled back',
      error: error.message,
      requestId,
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
      .select('firmId firmSlug name status createdAt')
      .sort({ createdAt: -1 });
    
    // Get counts for each firm
    const firmsWithCounts = await Promise.all(
      firms.map(async (firm) => {
        const clientCount = await Client.countDocuments({ firmId: firm._id });
        const userCount = await User.countDocuments({ firmId: firm._id });
        
        return {
          _id: firm._id,
          firmId: firm.firmId,
          firmSlug: firm.firmSlug,
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
 * Disable firm immediately (single action)
 * POST /api/superadmin/firms/:id/disable
 */
const disableFirmImmediately = async (req, res) => {
  try {
    const { id } = req.params;
    const firm = await Firm.findById(id);

    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }

    const oldStatus = firm.status;
    firm.status = 'SUSPENDED';
    await firm.save();

    await logSuperadminAction({
      actionType: 'FirmSuspended',
      description: `Firm disabled immediately: ${firm.name} (${firm.firmId})`,
      performedBy: req.user.email,
      performedById: req.user._id,
      targetEntityType: 'Firm',
      targetEntityId: firm._id.toString(),
      metadata: { firmId: firm.firmId, name: firm.name, oldStatus, newStatus: 'SUSPENDED' },
      req,
    });

    return res.json({
      success: true,
      message: 'Firm disabled immediately',
      data: {
        _id: firm._id,
        firmId: firm.firmId,
        name: firm.name,
        status: firm.status,
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error disabling firm immediately:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to disable firm',
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
      mustSetPassword: true,
      mustChangePassword: true,
      passwordSetupTokenHash: setupTokenHash,
      passwordSetupExpires: setupExpires,
      inviteSentAt: new Date(),
      passwordSetAt: null,
    });
    
    await adminUser.save();
    
    // Send password setup email
    try {
      await emailService.sendPasswordSetupEmail({
        email: adminUser.email,
        name: adminUser.name,
        token: setupToken,
        xID: normalizedXID,
        firmSlug: firm.firmSlug, // Pass firmSlug for firm-specific URL in email
        req,
      });
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

/**
 * Get firm metadata by slug (PUBLIC endpoint for login page)
 * GET /api/public/firms/:firmSlug
 */
const getFirmBySlug = async (req, res) => {
  try {
    const { firmSlug } = req.params;
    
    if (!firmSlug) {
      return res.status(400).json({
        success: false,
        message: 'Firm slug is required',
      });
    }
    
    const normalizedSlug = firmSlug.toLowerCase().trim();
    
    const firm = await Firm.findOne({ firmSlug: normalizedSlug })
      .select('firmId firmSlug name status');
    
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found',
      });
    }
    
    res.json({
      success: true,
      data: {
        firmId: firm.firmId,
        firmSlug: firm.firmSlug,
        name: firm.name,
        status: firm.status,
        isActive: firm.status === 'ACTIVE',
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error getting firm by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get firm',
      error: error.message,
    });
  }
};

/**
 * Operational health snapshot for pilot safety dashboard
 * GET /api/superadmin/health
 */
const getOperationalHealth = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
    }
    return res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        firms: getDashboardSnapshot(),
      },
    });
  } catch (error) {
    console.error('[SUPERADMIN] Error generating operational health:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate health snapshot',
      error: error.message,
    });
  }
};

module.exports = {
  createFirm: wrapWriteHandler(createFirm),
  listFirms,
  updateFirmStatus: wrapWriteHandler(updateFirmStatus),
  disableFirmImmediately: wrapWriteHandler(disableFirmImmediately),
  createFirmAdmin: wrapWriteHandler(createFirmAdmin),
  getPlatformStats,
  getFirmBySlug,
  getOperationalHealth,
};
