const User = require('../models/User.model');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const Case = require('../models/Case.model');
const AuthAudit = require('../models/AuthAudit.model');
const emailService = require('../services/email.service');
const { CASE_STATUS } = require('../config/constants');
const { logAdminAction, logCaseListViewed } = require('../services/auditLog.service');

/**
 * Admin Controller for Admin Panel Operations
 * PR #41 - Admin panel statistics and management
 * PR #48 - Admin resend invite email functionality
 * PR: Case Lifecycle - Admin dashboard for all cases, pending, filed
 */

const INVITE_TOKEN_EXPIRY_HOURS = 48; // 48 hours for invite tokens

/**
 * Helper function to safely log audit events without throwing
 * Prevents audit logging failures from crashing admin operations
 */
const safeAuditLog = async (auditData) => {
  try {
    await AuthAudit.create(auditData);
  } catch (auditError) {
    console.error('[ADMIN] Failed to log audit event:', auditError.message);
  }
};

/**
 * Get admin dashboard statistics
 * GET /api/admin/stats
 * 
 * Returns all counts needed for admin panel header badges:
 * - Total users
 * - Total clients (active + inactive)
 * - Total categories (including soft-deleted)
 * - Pending approvals
 * - All open cases (across all users)
 * - All pending cases (across all users)
 * - Filed cases
 * - Resolved cases
 * 
 * PR: Case Lifecycle - Added comprehensive case counts
 * PR: Fix Case Lifecycle - Added resolved cases count
 */
const getAdminStats = async (req, res) => {
  try {
    // Fetch all counts in parallel for performance
    const [
      totalUsers,
      totalClients,
      totalCategories,
      pendingApprovals,
      allOpenCases,
      allPendingCases,
      filedCases,
      resolvedCases,
    ] = await Promise.all([
      // Total users (all, regardless of status)
      User.countDocuments({}),
      
      // Total clients (active + inactive)
      Client.countDocuments({}),
      
      // Total categories (including soft-deleted via isActive: false)
      Category.countDocuments({}),
      
      // Pending approvals - cases with status 'Reviewed' or 'UNDER_REVIEW'
      Case.countDocuments({
        status: { $in: [CASE_STATUS.REVIEWED, CASE_STATUS.UNDER_REVIEW] }
      }),
      
      // All open cases across all users (for admin visibility)
      Case.countDocuments({ status: CASE_STATUS.OPEN }),
      
      // All pending cases across all users (for admin visibility)
      Case.countDocuments({ status: CASE_STATUS.PENDED }),
      
      // All filed cases (for admin visibility)
      Case.countDocuments({ status: CASE_STATUS.FILED }),
      
      // All resolved cases (for admin visibility)
      Case.countDocuments({ status: CASE_STATUS.RESOLVED }),
    ]);
    
    res.json({
      success: true,
      data: {
        totalUsers,
        totalClients,
        totalCategories,
        pendingApprovals,
        allOpenCases,
        allPendingCases,
        filedCases,
        resolvedCases,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching admin statistics',
      error: error.message,
    });
  }
};

/**
 * Resend invite email for a user who hasn't set password yet
 * POST /api/admin/users/:xID/resend-invite
 * 
 * PR #48: Admin-only endpoint to resend invite emails
 * - Bypasses password enforcement middleware
 * - Only works for users who haven't set password (passwordSet === false)
 * - Generates fresh invite token with 48-hour expiry
 * - Updates inviteSentAt timestamp
 */
const resendInviteEmail = async (req, res) => {
  try {
    const { xID } = req.params;
    
    if (!xID) {
      return res.status(400).json({
        success: false,
        message: 'xID is required',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find target user by xID (same-firm only, prevent Superadmin access)
    const user = await User.findOne({ 
      xID: xID.toUpperCase(),
      firmId: admin.firmId,
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in your firm',
      });
    }
    
    // Check if user has already activated their account
    if (user.passwordSet) {
      return res.status(400).json({
        success: false,
        message: 'User already activated. Cannot resend invite email for activated users.',
      });
    }
    
    // Generate new secure invite token (48-hour expiry)
    const token = emailService.generateSecureToken();
    const tokenHash = emailService.hashToken(token);
    const tokenExpiry = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);
    
    // Update token and inviteSentAt timestamp
    user.inviteTokenHash = tokenHash;
    user.inviteTokenExpiry = tokenExpiry;
    user.inviteSentAt = new Date();
    await user.save();
    
    // Fetch firmSlug for email
    let firmSlug = null;
    if (user.firmId) {
      const Firm = require('../models/Firm.model');
      const firm = await Firm.findById(user.firmId);
      if (firm) {
        firmSlug = firm.firmSlug;
      }
    }
    
    // Send invite reminder email with xID
    try {
      const emailResult = await emailService.sendPasswordSetupReminderEmail({
        email: user.email,
        name: user.name,
        token: token,
        xID: user.xID,
        firmSlug: firmSlug
      });
      
      if (!emailResult.success) {
        console.error('[ADMIN] Failed to send invite reminder email');
        
        // Log failure but continue - token was updated
        await safeAuditLog({
          xID: user.xID,
          actionType: 'InviteEmailResendFailed',
          description: `Admin attempted to resend invite email but delivery failed`,
          performedBy: admin.xID,
          ipAddress: req.ip,
        });
        
        return res.status(500).json({
          success: false,
          message: 'Failed to send email. Please check email service configuration.',
        });
      }
      
      // Log successful email send
      await safeAuditLog({
        xID: user.xID,
        actionType: 'InviteEmailResent',
        description: `Admin resent invite email to ${emailService.maskEmail(user.email)}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
      });
      
      res.json({
        success: true,
        message: 'Invite email sent successfully',
      });
    } catch (emailError) {
      console.error('[ADMIN] Failed to send invite email:', emailError.message);
      
      // Log failure
      await safeAuditLog({
        xID: user.xID,
        actionType: 'InviteEmailResendFailed',
        description: `Admin attempted to resend invite email but delivery failed`,
        performedBy: admin.xID,
        ipAddress: req.ip,
      });
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send email. Please check email service configuration.',
      });
    }
  } catch (error) {
    console.error('[ADMIN] Error resending invite email:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending invite email',
      error: error.message,
    });
  }
};

/**
 * Get all open cases (Admin view)
 * GET /api/admin/cases/open
 * 
 * Returns all cases with status OPEN across all users.
 * Admins can see all open cases regardless of assignment.
 * 
 * PR: Case Lifecycle - Admin visibility for all open cases
 */
const getAllOpenCases = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const cases = await Case.find({ status: CASE_STATUS.OPEN })
      .select('caseId caseName category createdAt updatedAt status clientId assignedTo')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await Case.countDocuments({ status: CASE_STATUS.OPEN });
    
    // Log admin action for audit
    await logCaseListViewed({
      viewerXID: req.user.xID,
      filters: { status: CASE_STATUS.OPEN },
      listType: 'ADMIN_ALL_OPEN_CASES',
      resultCount: cases.length,
    });
    
    res.json({
      success: true,
      data: cases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching open cases',
      error: error.message,
    });
  }
};

/**
 * Get all pending cases (Admin view)
 * GET /api/admin/cases/pending
 * 
 * Returns all cases with status PENDED across all users.
 * Admins can see all pending cases regardless of who pended them.
 * 
 * PR: Case Lifecycle - Admin visibility for all pending cases
 */
const getAllPendingCases = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const cases = await Case.find({ status: CASE_STATUS.PENDED })
      .select('caseId caseName category createdAt updatedAt status clientId assignedTo pendedByXID pendingUntil')
      .sort({ pendingUntil: 1 }) // Sort by pending deadline (earliest first)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await Case.countDocuments({ status: CASE_STATUS.PENDED });
    
    // Log admin action for audit
    await logCaseListViewed({
      viewerXID: req.user.xID,
      filters: { status: CASE_STATUS.PENDED },
      listType: 'ADMIN_ALL_PENDING_CASES',
      resultCount: cases.length,
    });
    
    res.json({
      success: true,
      data: cases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending cases',
      error: error.message,
    });
  }
};

/**
 * Get all filed cases (Admin view)
 * GET /api/admin/cases/filed
 * 
 * Returns all cases with status FILED.
 * Filed cases are hidden from employees and only visible to admins.
 * 
 * PR: Case Lifecycle - Admin visibility for filed cases
 */
const getAllFiledCases = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const cases = await Case.find({ status: CASE_STATUS.FILED })
      .select('caseId caseName category createdAt updatedAt status clientId assignedTo lastActionByXID lastActionAt')
      .sort({ lastActionAt: -1 }) // Sort by last action (most recently filed first)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await Case.countDocuments({ status: CASE_STATUS.FILED });
    
    // MANDATORY: Log admin filed cases access for audit
    await logAdminAction({
      adminXID: req.user.xID,
      actionType: 'ADMIN_FILED_CASES_VIEWED',
      metadata: {
        page: parseInt(page),
        limit: parseInt(limit),
        resultCount: cases.length,
        total,
      },
    });
    
    res.json({
      success: true,
      data: cases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching filed cases',
      error: error.message,
    });
  }
};

/**
 * Get all resolved cases (Admin view)
 * GET /api/admin/cases/resolved
 * 
 * Returns all cases with status RESOLVED.
 * Admins can see all resolved cases regardless of who resolved them.
 * 
 * PR: Fix Case Lifecycle - Admin visibility for resolved cases
 */
const getAllResolvedCases = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const cases = await Case.find({ status: CASE_STATUS.RESOLVED })
      .select('caseId caseName category createdAt updatedAt status clientId assignedTo lastActionByXID lastActionAt')
      .sort({ lastActionAt: -1 }) // Sort by last action (most recently resolved first)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .lean();
    
    const total = await Case.countDocuments({ status: CASE_STATUS.RESOLVED });
    
    // Log admin action for audit
    await logAdminAction({
      adminXID: req.user.xID,
      actionType: 'ADMIN_RESOLVED_CASES_VIEWED',
      metadata: {
        page: parseInt(page),
        limit: parseInt(limit),
        resultCount: cases.length,
        total,
      },
    });
    
    res.json({
      success: true,
      data: cases,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching resolved cases',
      error: error.message,
    });
  }
};

/**
 * Update user's restricted client list (Admin only)
 * PATCH /api/admin/users/:xID/restrict-clients
 * 
 * Allows admin to manage which clients a user cannot access (deny-list approach).
 * Default: empty array means user can access all clients.
 * 
 * Request body:
 * {
 *   restrictedClientIds: ["C123456", "C123457"] // Array of client IDs to restrict
 * }
 */
const updateRestrictedClients = async (req, res) => {
  try {
    const { xID } = req.params;
    const { restrictedClientIds } = req.body;
    
    if (!xID) {
      return res.status(400).json({
        success: false,
        message: 'xID is required',
      });
    }
    
    if (!Array.isArray(restrictedClientIds)) {
      return res.status(400).json({
        success: false,
        message: 'restrictedClientIds must be an array',
      });
    }
    
    // Get admin from authenticated request
    const admin = req.user;
    
    // Find target user by xID (same-firm only)
    const user = await User.findOne({ 
      xID: xID.toUpperCase(),
      firmId: admin.firmId,
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found in your firm',
      });
    }
    
    // Validate all client IDs are in correct format
    const invalidIds = restrictedClientIds.filter(id => !/^C\d{6}$/.test(id));
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid client ID format: ${invalidIds.join(', ')}. Must be C123456 format.`,
      });
    }
    
    // Capture previous value before update for accurate audit (after validation)
    const previousRestrictedClientIds = user.restrictedClientIds || [];
    
    // Update restricted clients list
    user.restrictedClientIds = restrictedClientIds;
    await user.save();
    
    // Log admin action for audit
    await logAdminAction({
      adminXID: admin.xID,
      actionType: 'USER_CLIENT_ACCESS_UPDATED',
      targetXID: user.xID,
      metadata: {
        previousClientIds: previousRestrictedClientIds,
        restrictedClientIds,
        previousCount: previousRestrictedClientIds.length,
        newCount: restrictedClientIds.length,
      },
    });
    
    res.json({
      success: true,
      message: 'User client access restrictions updated successfully',
      data: {
        xID: user.xID,
        restrictedClientIds: user.restrictedClientIds,
      },
    });
  } catch (error) {
    console.error('[ADMIN] Error updating restricted clients:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating client access restrictions',
      error: error.message,
    });
  }
};

module.exports = {
  getAdminStats,
  resendInviteEmail,
  getAllOpenCases,
  getAllPendingCases,
  getAllFiledCases,
  getAllResolvedCases,
  updateRestrictedClients,
};
