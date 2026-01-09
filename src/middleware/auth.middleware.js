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
    // Accept both xID and XID from request payload, normalize internally
    const rawXID = req.body?.xID || req.body?.XID || req.query?.xID || req.query?.XID || req.headers['x-user-id'];
    
    if (!rawXID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide xID.',
      });
    }
    
    // Normalize xID: trim whitespace and convert to uppercase
    const normalizedXID = rawXID.trim().toUpperCase();
    
    // Find user by normalized xID
    const user = await User.findOne({ xID: normalizedXID });
    
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
    
    // Special case: allow change-password and profile endpoints even if mustChangePassword is true
    // Check if this is the change-password or profile endpoint
    const isChangePasswordEndpoint = req.path.endsWith('/change-password');
    const isProfileEndpoint = req.path.endsWith('/profile');
    
    // Block access to other routes if password change is required
    // IMPORTANT: Admin users are exempt from this restriction to allow user management operations
    // (e.g., resending invite emails for users without passwords)
    if (user.mustChangePassword && !isChangePasswordEndpoint && !isProfileEndpoint && user.role !== 'Admin') {
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
