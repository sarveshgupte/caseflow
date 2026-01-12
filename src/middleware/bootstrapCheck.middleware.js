/**
 * Bootstrap Completion Check Middleware
 * 
 * Enforces that Admin users can only access dashboard and data routes
 * after their firm's bootstrap process is completed.
 * 
 * This middleware prevents the login deadlock by:
 * 1. NOT blocking authentication endpoints (login, set-password, Google OAuth)
 * 2. ONLY blocking access to firm data routes until bootstrap is complete
 * 
 * This allows Admin users to:
 * - Log in successfully
 * - Set their password
 * - Link Google account
 * - Reach a "firm setup incomplete" UI
 * - Complete the bootstrap process
 * - Then access firm data
 */

const Firm = require('../models/Firm.model');

/**
 * Require completed firm bootstrap for Admin users
 * 
 * Use this middleware on routes that require firm bootstrap to be completed:
 * - Dashboard routes
 * - Case routes
 * - Client routes
 * - User management routes
 * - Report routes
 * 
 * DO NOT use on:
 * - Authentication routes (login, logout, set-password)
 * - Profile routes
 * - OAuth callbacks
 * - Bootstrap completion routes themselves
 */
const requireCompletedFirm = async (req, res, next) => {
  try {
    // Only check Admin users (SuperAdmin and Employees are exempt)
    if (req.user.role !== 'Admin') {
      return next();
    }
    
    // Admin must have firmId
    if (!req.user.firmId) {
      console.error(`[BOOTSTRAP] Admin user ${req.user.xID} missing firmId`);
      return res.status(500).json({
        success: false,
        message: 'Account configuration error. Please contact administrator.',
      });
    }
    
    // Check firm bootstrap status
    const firm = await Firm.findById(req.user.firmId);
    
    if (!firm) {
      console.error(`[BOOTSTRAP] Firm not found for admin ${req.user.xID}, firmId: ${req.user.firmId}`);
      return res.status(500).json({
        success: false,
        message: 'Firm not found. Please contact administrator.',
      });
    }
    
    // Block access if bootstrap not completed
    if (firm.bootstrapStatus !== 'COMPLETED') {
      console.warn(`[BOOTSTRAP] Access blocked for ${req.user.xID} - firm bootstrap not completed (status: ${firm.bootstrapStatus})`);
      return res.status(403).json({
        success: false,
        code: 'FIRM_BOOTSTRAP_INCOMPLETE',
        message: 'Firm setup is incomplete. Please complete the setup process before accessing this feature.',
        bootstrapStatus: firm.bootstrapStatus,
      });
    }
    
    // Bootstrap completed - allow access
    next();
  } catch (error) {
    console.error('[BOOTSTRAP] Error checking firm bootstrap status:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking firm setup status',
      error: error.message,
    });
  }
};

module.exports = {
  requireCompletedFirm,
};
