/**
 * xID Ownership Validation Middleware
 * 
 * PR #44: Enforce xID as the ONLY canonical identifier for case ownership
 * 
 * This middleware provides guardrails to prevent email-based case attribution
 * and ensures xID is used consistently across all ownership operations.
 * 
 * Key Responsibilities:
 * - Block payloads attempting to set createdByEmail or assignedToEmail
 * - Validate that createdByXid is derived from auth context (never from payload)
 * - Validate that assignedToXid is provided when assigning cases
 * - Log warnings in dev/staging when violations are detected
 */

const { isProduction } = require('../config/config');

/**
 * Reject payloads containing deprecated email-based ownership fields
 * 
 * This middleware blocks any attempt to use:
 * - createdByEmail
 * - assignedToEmail
 * 
 * These fields are deprecated and must never be used for ownership logic.
 */
const rejectEmailOwnershipFields = (req, res, next) => {
  const payload = req.body;
  
  // Check for forbidden email-based ownership fields
  const forbiddenFields = ['createdByEmail', 'assignedToEmail'];
  const foundForbidden = forbiddenFields.filter(field => 
    payload.hasOwnProperty(field) && payload[field] !== null && payload[field] !== undefined
  );
  
  if (foundForbidden.length > 0) {
    // Log warning in non-production environments
    if (!isProduction()) {
      console.warn(`[xID Guardrail] Attempt to use deprecated email-based ownership fields: ${foundForbidden.join(', ')}`);
      console.warn(`[xID Guardrail] Request path: ${req.method} ${req.path}`);
      console.warn(`[xID Guardrail] User: ${req.user?.xID || 'Unknown'}`);
    }
    
    return res.status(400).json({
      success: false,
      message: 'Email-based ownership fields are not supported. Use xID for all ownership operations.',
      invalidFields: foundForbidden,
      hint: 'Remove createdByEmail and assignedToEmail from your request. Use createdByXid and assignedTo with xID values instead.',
    });
  }
  
  next();
};

/**
 * Validate xID presence for case creation
 * 
 * Ensures that:
 * - User is authenticated (req.user.xID exists)
 * - createdByXID will be derived from authenticated user (not from payload)
 * 
 * This middleware should be applied to case creation endpoints.
 */
const validateCreatorXid = (req, res, next) => {
  // Verify authenticated user context exists
  if (!req.user || !req.user.xID) {
    // Log warning in non-production environments
    if (!isProduction()) {
      console.warn(`[xID Guardrail] Case creation attempted without authenticated xID context`);
      console.warn(`[xID Guardrail] Request path: ${req.method} ${req.path}`);
    }
    
    return res.status(401).json({
      success: false,
      message: 'Authentication required - user xID not found',
      hint: 'Ensure you are authenticated before creating cases. The creator xID is derived from your authenticated session.',
    });
  }
  
  // Block if payload attempts to specify createdByXID (should always be from auth context)
  if (req.body.createdByXID || req.body.createdByXid) {
    if (!isProduction()) {
      console.warn(`[xID Guardrail] Attempt to override createdByXID in payload`);
      console.warn(`[xID Guardrail] User: ${req.user.xID}`);
    }
    
    return res.status(400).json({
      success: false,
      message: 'Cannot specify createdByXID in request payload. It is automatically derived from your authenticated session.',
      hint: 'Remove createdByXID from your request body.',
    });
  }
  
  next();
};

/**
 * Validate xID format for assignment operations
 * 
 * Ensures that when assignedTo is provided:
 * - It matches xID format (X followed by 6 digits)
 * - It is not an email address
 * 
 * This middleware should be applied to case assignment endpoints.
 */
const validateAssignmentXid = (req, res, next) => {
  const { assignedTo } = req.body;
  
  // If assignedTo is not provided, skip validation (null assignments are valid)
  if (!assignedTo) {
    return next();
  }
  
  // Normalize the value
  const trimmedValue = assignedTo.trim();
  
  // Check if it looks like an email (contains @)
  if (trimmedValue.includes('@')) {
    if (!isProduction()) {
      console.warn(`[xID Guardrail] Attempt to assign case using email address: ${trimmedValue}`);
      console.warn(`[xID Guardrail] Request path: ${req.method} ${req.path}`);
      console.warn(`[xID Guardrail] User: ${req.user?.xID || 'Unknown'}`);
    }
    
    return res.status(400).json({
      success: false,
      message: 'Cannot assign cases using email addresses. Use xID instead.',
      providedValue: trimmedValue,
      hint: 'Use the user\'s xID (format: X123456) for case assignment.',
    });
  }
  
  // Check if it matches xID format (X followed by 6 digits)
  const xidPattern = /^X\d{6}$/i;
  if (!xidPattern.test(trimmedValue)) {
    if (!isProduction()) {
      console.warn(`[xID Guardrail] Invalid xID format for assignment: ${trimmedValue}`);
      console.warn(`[xID Guardrail] Request path: ${req.method} ${req.path}`);
    }
    
    return res.status(400).json({
      success: false,
      message: 'Invalid xID format. Expected format: X123456 (X followed by 6 digits)',
      providedValue: trimmedValue,
    });
  }
  
  next();
};

/**
 * Combined validation for case creation
 * Applies all relevant guardrails for creating cases
 */
const validateCaseCreation = [
  rejectEmailOwnershipFields,
  validateCreatorXid,
  validateAssignmentXid,
];

/**
 * Combined validation for case assignment
 * Applies all relevant guardrails for assigning cases
 */
const validateCaseAssignment = [
  rejectEmailOwnershipFields,
  validateAssignmentXid,
];

module.exports = {
  rejectEmailOwnershipFields,
  validateCreatorXid,
  validateAssignmentXid,
  validateCaseCreation,
  validateCaseAssignment,
};
