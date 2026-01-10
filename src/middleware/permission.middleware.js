const User = require('../models/User.model');

/**
 * Permission Middleware for Docketra Case Management System
 * 
 * Role-based access control for admin-only and superadmin-only operations
 */

/**
 * Require Admin role
 * Must be used after authenticate middleware
 * 
 * @deprecated Use policy-based authorization instead: authorize(AdminPolicy.isAdmin)
 * This middleware is kept for backward compatibility but should be replaced
 * with declarative policy guards in new code.
 */
const requireAdmin = async (req, res, next) => {
  try {
    const user = await User.findOne({ xID: req.user.xID });
    
    if (!user || user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }
    
    req.userDoc = user;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking permissions',
      error: error.message,
    });
  }
};

/**
 * Require Superadmin role
 * Must be used after authenticate middleware
 * Superadmin has platform-level access, no firmId
 * 
 * @deprecated Use policy-based authorization instead: authorize(SuperAdminPolicy.isSuperAdmin)
 * This middleware is kept for backward compatibility but should be replaced
 * with declarative policy guards in new code.
 */
const requireSuperadmin = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Superadmin access required',
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking permissions',
      error: error.message,
    });
  }
};

/**
 * Block Superadmin from accessing firm data routes
 * Must be used after authenticate middleware
 * Returns 403 if user is SuperAdmin
 */
const blockSuperadmin = async (req, res, next) => {
  try {
    if (req.user && req.user.role === 'SuperAdmin') {
      return res.status(403).json({
        success: false,
        message: 'Superadmin cannot access firm data',
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking permissions',
      error: error.message,
    });
  }
};

/**
 * PART 6: Require Firm Context (Defensive Assertion)
 * Ensures non-SuperAdmin users have firmId
 * Must be used after authenticate middleware
 * This is a fail-fast guard to protect against future route refactors
 */
const requireFirmContext = async (req, res, next) => {
  try {
    // SuperAdmin doesn't have firmId - that's expected
    if (req.user && req.user.role === 'SuperAdmin') {
      return next();
    }
    
    // All other users MUST have firmId
    if (!req.user || !req.user.firmId) {
      console.error('[PERMISSION] Firm context missing for non-SuperAdmin user', {
        xID: req.user?.xID || 'unknown',
        role: req.user?.role || 'unknown',
        path: req.path,
      });
      
      return res.status(500).json({
        success: false,
        message: 'Firm context missing. Please contact administrator.',
      });
    }
    
    next();
  } catch (error) {
    console.error('[PERMISSION] Error checking firm context:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking permissions',
      error: error.message,
    });
  }
};

module.exports = { 
  requireAdmin, 
  requireSuperadmin, 
  blockSuperadmin,
  requireFirmContext,
};
