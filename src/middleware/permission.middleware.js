const User = require('../models/User.model');

/**
 * Permission Middleware for Docketra Case Management System
 * 
 * Role-based access control for admin-only and superadmin-only operations
 */

/**
 * Require Admin role
 * Must be used after authenticate middleware
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
 */
const requireSuperadmin = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'SUPER_ADMIN') {
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
 * Returns 403 if user is SUPER_ADMIN
 */
const blockSuperadmin = async (req, res, next) => {
  try {
    if (req.user && req.user.role === 'SUPER_ADMIN') {
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

module.exports = { requireAdmin, requireSuperadmin, blockSuperadmin };
