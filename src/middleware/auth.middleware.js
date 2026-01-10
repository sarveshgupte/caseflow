const User = require('../models/User.model');
const jwtService = require('../services/jwt.service');

/**
 * Authentication Middleware for Docketra Case Management System
 * 
 * Validates JWT Bearer tokens and attaches user data to request
 * Enforces firm-level data isolation
 * 
 * PART A - Authentication & Access Control
 */

/**
 * Authenticate user - validate JWT and attach full user data to request
 * Verifies JWT token from Authorization header
 * Verifies user exists and is active
 * Attaches user document to req.user with userId, firmId, role
 * Special case: allows password changes for users with mustChangePassword flag
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = jwtService.extractTokenFromHeader(authHeader);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.',
      });
    }
    
    // Verify and decode JWT
    let decoded;
    try {
      decoded = jwtService.verifyAccessToken(token);
    } catch (error) {
      if (error.message === 'Token expired') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please refresh your token.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }
    
    // ============================================================
    // SUPERADMIN TOKEN HANDLING (NO DATABASE LOOKUP)
    // ============================================================
    // SuperAdmin tokens have role: 'SuperAdmin' and userId: 'SUPERADMIN'
    // They never have firmId or defaultClientId
    if (decoded.role === 'SuperAdmin' && decoded.userId === 'SUPERADMIN') {
      console.log('[AUTH] SuperAdmin token authenticated');
      
      // Attach SuperAdmin pseudo-user to request
      req.user = {
        xID: process.env.SUPERADMIN_XID || 'SUPERADMIN',
        email: process.env.SUPERADMIN_EMAIL || 'superadmin@docketra.local',
        role: 'SuperAdmin',
        _id: 'SUPERADMIN', // Pseudo ID for consistency
        isActive: true,
        // NO firmId
        // NO defaultClientId
      };
      
      // Attach decoded JWT data
      req.jwt = {
        userId: 'SUPERADMIN',
        role: 'SuperAdmin',
        firmId: null,
      };
      
      return next();
    }
    
    // ============================================================
    // NORMAL USER TOKEN HANDLING (DATABASE LOOKUP)
    // ============================================================
    
    // Find user by ID from token
    const user = await User.findById(decoded.userId);
    
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
    
    // Verify firmId matches (multi-tenancy check)
    // Skip this check for SUPER_ADMIN (they have no firmId)
    if (user.role !== 'SUPER_ADMIN') {
      if (user.firmId && decoded.firmId && user.firmId.toString() !== decoded.firmId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Firm access violation detected.',
        });
      }
    }
    
    // Check if user's firm is suspended (Superadmin exempt)
    if (user.role !== 'SUPER_ADMIN' && user.firmId) {
      const Firm = require('../models/Firm.model');
      const firm = await Firm.findById(user.firmId);
      if (firm && firm.status === 'SUSPENDED') {
        return res.status(403).json({
          success: false,
          message: 'Your firm has been suspended. Please contact support.',
          code: 'FIRM_SUSPENDED',
        });
      }
    }
    
    // Special case: allow change-password and profile endpoints even if mustChangePassword is true
    // Check if this is the change-password or profile endpoint
    const isChangePasswordEndpoint = req.path.endsWith('/change-password');
    const isProfileEndpoint = req.path.endsWith('/profile');
    const isRefreshEndpoint = req.path.endsWith('/refresh');
    
    // Block access to other routes if password change is required
    // IMPORTANT: Admin users are exempt from this restriction to allow user management operations
    // (e.g., resending invite emails for users without passwords)
    if (user.mustChangePassword && !isChangePasswordEndpoint && !isProfileEndpoint && !isRefreshEndpoint) {
      if (user.role === 'Admin') {
        // Log admin exemption for audit purposes
        console.log(`[AUTH] Admin user ${user.xID} accessing ${req.method} ${req.path} with mustChangePassword=true (exempted from password enforcement)`);
      } else {
        return res.status(403).json({
          success: false,
          message: 'You must change your password before accessing other resources.',
          mustChangePassword: true,
        });
      }
    }
    
    // Attach full user object to request
    req.user = user;
    
    // Also attach decoded JWT data for convenience
    req.jwt = {
      userId: decoded.userId,
      firmId: decoded.firmId || null, // May be null for SUPER_ADMIN
      role: decoded.role,
    };
    
    next();
  } catch (error) {
    console.error('[AUTH] Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      error: error.message,
    });
  }
};

module.exports = { authenticate };
