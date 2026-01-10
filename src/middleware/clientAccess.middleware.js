const Case = require('../models/Case.model');
const Client = require('../models/Client.model');

/**
 * Client Access Control Middleware
 * 
 * Enforces user-level client access restrictions (deny-list approach).
 * Default: users can access all clients (restrictedClientIds = [])
 * Admin-managed: admins can restrict specific client access per user
 * 
 * Enforcement points:
 * - Case creation with restricted client
 * - Case viewing with restricted client
 * - Case list filtering
 * - Deep link access prevention
 * 
 * PR: Client Fact Sheet + User Client Access Control
 */

/**
 * Check if user can access a specific client
 * Used for case creation and individual case access
 */
const checkClientAccess = async (req, res, next) => {
  try {
    const user = req.user;
    const clientId = req.body.clientId || req.params.clientId;
    
    if (!clientId) {
      // No client specified, continue
      return next();
    }
    
    // Check if user has restrictions
    if (!user.restrictedClientIds || user.restrictedClientIds.length === 0) {
      // No restrictions, allow access
      return next();
    }
    
    // Check if client is in restricted list
    if (user.restrictedClientIds.includes(clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to access this client',
        code: 'CLIENT_ACCESS_RESTRICTED',
      });
    }
    
    next();
  } catch (error) {
    console.error('[CLIENT_ACCESS] Error checking client access:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking client access',
      error: error.message,
    });
  }
};

/**
 * Check if user can access a case based on its client
 * Used for case detail viewing and updates
 */
const checkCaseClientAccess = async (req, res, next) => {
  try {
    const user = req.user;
    const caseId = req.params.caseId || req.params.id;
    
    if (!caseId) {
      // No case specified, continue
      return next();
    }
    
    // Check if user has restrictions
    if (!user.restrictedClientIds || user.restrictedClientIds.length === 0) {
      // No restrictions, allow access
      return next();
    }
    
    // Find the case and check its client
    const caseData = await Case.findOne({ caseId }).select('clientId').lean();
    
    if (!caseData) {
      // Case not found, let the controller handle it
      return next();
    }
    
    // Check if case's client is in restricted list
    if (user.restrictedClientIds.includes(caseData.clientId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to access cases for this client',
        code: 'CLIENT_ACCESS_RESTRICTED',
      });
    }
    
    next();
  } catch (error) {
    console.error('[CLIENT_ACCESS] Error checking case client access:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking case access',
      error: error.message,
    });
  }
};

/**
 * Filter cases by removing those with restricted clients
 * Used for case list endpoints
 * Adds a query filter to exclude restricted clients
 */
const applyClientAccessFilter = (req, res, next) => {
  try {
    const user = req.user;
    
    // Check if user has restrictions
    if (!user.restrictedClientIds || user.restrictedClientIds.length === 0) {
      // No restrictions, continue without filter
      return next();
    }
    
    // Add client filter to request for downstream use
    req.clientAccessFilter = {
      clientId: { $nin: user.restrictedClientIds },
    };
    
    next();
  } catch (error) {
    console.error('[CLIENT_ACCESS] Error applying client access filter:', error);
    res.status(500).json({
      success: false,
      message: 'Error applying client access filter',
      error: error.message,
    });
  }
};

module.exports = {
  checkClientAccess,
  checkCaseClientAccess,
  applyClientAccessFilter,
};
