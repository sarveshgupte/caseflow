const User = require('../models/User.model');
const Client = require('../models/Client.model');
const Category = require('../models/Category.model');
const Case = require('../models/Case.model');
const AuthAudit = require('../models/AuthAudit.model');
const emailService = require('../services/email.service');
const { CASE_STATUS } = require('../config/constants');

/**
 * Admin Controller for Admin Panel Operations
 * PR #41 - Admin panel statistics and management
 * PR #48 - Admin resend invite email functionality
 */

const INVITE_TOKEN_EXPIRY_HOURS = 48; // 48 hours for invite tokens

/**
 * Get admin dashboard statistics
 * GET /api/admin/stats
 * 
 * Returns all counts needed for admin panel header badges:
 * - Total users
 * - Total clients (active + inactive)
 * - Total categories (including soft-deleted)
 * - Pending approvals
 */
const getAdminStats = async (req, res) => {
  try {
    // Fetch all counts in parallel for performance
    const [
      totalUsers,
      totalClients,
      totalCategories,
      pendingApprovals,
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
    ]);
    
    res.json({
      success: true,
      data: {
        totalUsers,
        totalClients,
        totalCategories,
        pendingApprovals,
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
    
    // Find target user by xID
    const user = await User.findOne({ xID: xID.toUpperCase() });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
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
    
    // Send invite reminder email with xID
    try {
      const emailResult = await emailService.sendPasswordSetupReminderEmail(
        user.email, 
        user.name, 
        token, 
        user.xID
      );
      
      if (!emailResult.success) {
        console.error('[ADMIN] Failed to send invite reminder email:', emailResult.error);
        
        // Log failure but continue - token was updated
        await AuthAudit.create({
          xID: user.xID,
          actionType: 'InviteEmailResendFailed',
          description: `Admin attempted to resend invite email but delivery failed: ${emailResult.error}`,
          performedBy: admin.xID,
          ipAddress: req.ip,
        });
        
        return res.status(500).json({
          success: false,
          message: 'Failed to send email. Please check SMTP configuration.',
          error: emailResult.error,
        });
      }
      
      // Log successful email send
      await AuthAudit.create({
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
      await AuthAudit.create({
        xID: user.xID,
        actionType: 'InviteEmailResendFailed',
        description: `Admin attempted to resend invite email but delivery failed: ${emailError.message}`,
        performedBy: admin.xID,
        ipAddress: req.ip,
      });
      
      return res.status(500).json({
        success: false,
        message: 'Failed to send email. Please check SMTP configuration.',
        error: emailError.message,
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

module.exports = {
  getAdminStats,
  resendInviteEmail,
};
