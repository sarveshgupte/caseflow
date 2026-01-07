const User = require('../models/User.model');

/**
 * Authentication Middleware for Docketra Case Management System
 * 
 * Validates xID-based authentication and attaches user data to request
 * In production, this would validate JWT tokens or session cookies
 * 
 * PART A - Authentication & Access Control
 */

/**
 * Authenticate user - extract xID and attach full user data to request
 * Checks for xID in body, query, or headers
 * Verifies user exists and is active
 * Attaches user document to req.user
 * Special case: allows password changes for users with mustChangePassword flag
 */
const authenticate = async (req, res, next) => {
  try {
    const xID = req.body.xID || req.query.xID || req.headers['x-user-id'];
    
    if (!xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide xID.',
      });
    }
    
    // Find user by xID
    const user = await User.findOne({ xID: xID.toUpperCase() });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication credentials.',
      });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.',
      });
    }
    
    // Special case: allow change-password endpoint even if mustChangePassword is true
    // Check if this is the change-password endpoint
    const isChangePasswordEndpoint = req.path.endsWith('/change-password');
    
    // Block access to other routes if password change is required
    if (user.mustChangePassword && !isChangePasswordEndpoint) {
      return res.status(403).json({
        success: false,
        message: 'You must change your password before accessing other resources.',
        mustChangePassword: true,
      });
    }
    
    // Attach full user object to request
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message,
    });
  }
};

module.exports = { authenticate };
