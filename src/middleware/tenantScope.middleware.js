/**
 * Tenant Scoping Middleware for Docketra Case Management System
 * 
 * Automatically injects firmId into queries to enforce multi-tenancy
 * Prevents cross-firm data access by default
 * 
 * IMPORTANT: This middleware must be applied AFTER authentication middleware
 */

/**
 * Add firmId to request context for tenant-scoped queries
 * This middleware attaches the firmId to req for use in controllers
 * Controllers should manually add firmId to their queries
 */
const addTenantContext = (req, res, next) => {
  // Ensure user is authenticated
  if (!req.user || !req.user.firmId) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required for tenant-scoped operations',
    });
  }
  
  // Add firmId to request context
  req.firmId = req.user.firmId;
  
  // Log tenant context for audit (in development)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[TENANT] Request scoped to firm: ${req.firmId} by user: ${req.user.xID}`);
  }
  
  next();
};

/**
 * Validate that query includes firmId for tenant safety
 * This is a helper function that controllers can use to verify tenant scoping
 * 
 * @param {Object} query - MongoDB query object
 * @param {string} firmId - Expected firmId
 * @returns {Object} Query with firmId added
 */
const ensureFirmIdInQuery = (query, firmId) => {
  if (!firmId) {
    throw new Error('firmId is required for tenant-scoped queries');
  }
  
  return {
    ...query,
    firmId,
  };
};

/**
 * Validate that document belongs to user's firm
 * Use this to prevent unauthorized cross-firm access
 * 
 * @param {Object} document - MongoDB document
 * @param {string} userFirmId - User's firmId from req.user
 * @returns {boolean} True if document belongs to user's firm
 */
const validateFirmAccess = (document, userFirmId) => {
  if (!document) {
    return false;
  }
  
  if (!document.firmId) {
    console.warn('[TENANT] Document missing firmId field - possible data integrity issue');
    return false;
  }
  
  return document.firmId === userFirmId;
};

module.exports = {
  addTenantContext,
  ensureFirmIdInQuery,
  validateFirmAccess,
};
