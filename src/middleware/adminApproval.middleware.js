const User = require('../models/User.model');

/**
 * Admin Approval Middleware
 * 
 * Enforces hierarchy-based client approval permissions
 * Only top-most admins can approve client cases:
 * - managerId = null (no manager above them)
 * - OR canApproveClients = true (explicit permission)
 * 
 * Usage: Apply this middleware to client approval endpoints
 */

/**
 * Check if user has client approval permissions
 * Backend-only enforcement for security
 */
const checkClientApprovalPermission = async (req, res, next) => {
  try {
    const approverEmail = req.body.approverEmail || req.body.userEmail;
    
    if (!approverEmail) {
      return res.status(400).json({
        success: false,
        message: 'Approver email is required',
      });
    }
    
    // Find the user by email
    const user = await User.findOne({ 
      email: approverEmail.toLowerCase(),
      isActive: true 
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found or inactive',
      });
    }
    
    // Check if user is Admin
    if (user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Only Admin users can approve client cases',
      });
    }
    
    // Check hierarchy: top-most admin (managerId = null) OR explicit permission
    const isTopMostAdmin = user.managerId === null || user.managerId === undefined;
    const hasExplicitPermission = user.canApproveClients === true;
    
    if (!isTopMostAdmin && !hasExplicitPermission) {
      return res.status(403).json({
        success: false,
        message: 'Only top-most admins or users with explicit client approval permissions can approve client cases',
      });
    }
    
    // Store user data for use in controller
    req.approverUser = user;
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking approval permissions',
      error: error.message,
    });
  }
};

module.exports = {
  checkClientApprovalPermission,
};
