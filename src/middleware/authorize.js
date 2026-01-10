/**
 * Authorization Guard Middleware
 * 
 * Centralized authorization middleware for declarative policy enforcement.
 * Used to protect routes with policy-based authorization checks.
 * 
 * Design Principles:
 * 1. Fail-closed by default (deny if policy undefined/false/throws)
 * 2. Policies are pure functions that return boolean
 * 3. Authorization happens AFTER authentication
 * 4. Controllers never contain role logic
 * 
 * Usage:
 * router.post('/cases', authorize(CasePolicy.canCreate), createCase);
 * router.delete('/cases/:id', authorize(CasePolicy.canDelete), deleteCase);
 */

/**
 * Authorization guard middleware factory
 * 
 * @param {Function} policyFn - Policy function that returns boolean
 * @returns {Function} Express middleware function
 * 
 * Example:
 * const { authorize } = require('./middleware/authorize');
 * const CasePolicy = require('./policies/case.policy');
 * 
 * router.post('/cases', authorize(CasePolicy.canCreate), createCase);
 */
const authorize = (policyFn) => {
  // Validate policy function is provided
  if (typeof policyFn !== 'function') {
    throw new Error('authorize() requires a policy function as argument');
  }
  
  return (req, res, next) => {
    // Fail-closed: deny if not authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthenticated - authentication required',
      });
    }
    
    try {
      // Execute policy function
      const allowed = policyFn(req.user, req);
      
      // Fail-closed: deny if policy returns false or falsy
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden - insufficient permissions',
        });
      }
      
      // Policy passed - proceed to next middleware/controller
      next();
    } catch (error) {
      // Fail-closed: deny if policy throws error
      console.error('[AUTHORIZE] Policy execution error:', error);
      return res.status(403).json({
        success: false,
        message: 'Forbidden - authorization check failed',
      });
    }
  };
};

/**
 * Alternative authorization guard that accepts a custom error message
 * 
 * @param {Function} policyFn - Policy function that returns boolean
 * @param {string} errorMessage - Custom error message for 403 response
 * @returns {Function} Express middleware function
 * 
 * Example:
 * router.post('/cases', 
 *   authorizeWithMessage(CasePolicy.canCreate, 'Only Admin and Employee can create cases'),
 *   createCase
 * );
 */
const authorizeWithMessage = (policyFn, errorMessage) => {
  if (typeof policyFn !== 'function') {
    throw new Error('authorizeWithMessage() requires a policy function as first argument');
  }
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthenticated - authentication required',
      });
    }
    
    try {
      const allowed = policyFn(req.user, req);
      
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: errorMessage || 'Forbidden - insufficient permissions',
        });
      }
      
      next();
    } catch (error) {
      console.error('[AUTHORIZE] Policy execution error:', error);
      return res.status(403).json({
        success: false,
        message: errorMessage || 'Forbidden - authorization check failed',
      });
    }
  };
};

module.exports = {
  authorize,
  authorizeWithMessage,
};
