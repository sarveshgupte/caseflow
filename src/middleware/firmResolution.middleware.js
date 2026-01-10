/**
 * Firm Resolution Middleware
 * Extracts firmSlug from request and resolves to firmId
 * Attaches firmId to request context for authentication
 */

const Firm = require('../models/Firm.model');

/**
 * Resolve firmSlug to firmId and attach to request
 * Used for firm-scoped login
 * 
 * Extracts firmSlug from:
 * 1. Request body (firmSlug field)
 * 2. Request query parameter (?firmSlug=xyz)
 * 3. Route parameter (/:firmSlug)
 * 
 * Priority: body > query > params
 */
const resolveFirmSlug = async (req, res, next) => {
  try {
    // Extract firmSlug from request
    const firmSlug = req.body.firmSlug || req.query.firmSlug || req.params.firmSlug;
    
    if (!firmSlug) {
      return res.status(400).json({
        success: false,
        message: 'Firm context is required. Please use a firm-specific login URL.',
      });
    }
    
    // Normalize firmSlug (lowercase, trim)
    const normalizedSlug = firmSlug.toLowerCase().trim();
    
    // Resolve firmSlug to firm
    const firm = await Firm.findOne({ firmSlug: normalizedSlug });
    
    if (!firm) {
      return res.status(404).json({
        success: false,
        message: 'Firm not found. Please check your login URL.',
      });
    }
    
    // Check if firm is active
    if (firm.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        message: 'This firm is currently inactive. Please contact support.',
      });
    }
    
    // Attach firm context to request
    req.firmSlug = normalizedSlug;
    req.firmId = firm._id;
    req.firmIdString = firm.firmId; // String format (e.g., FIRM001)
    req.firmName = firm.name;
    
    next();
  } catch (error) {
    console.error('[FIRM_RESOLUTION] Error resolving firmSlug:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve firm context',
      error: error.message,
    });
  }
};

/**
 * Optional firm resolution - doesn't fail if firmSlug is missing
 * Used for APIs that support both firm-scoped and non-firm-scoped access
 */
const optionalFirmResolution = async (req, res, next) => {
  try {
    const firmSlug = req.body.firmSlug || req.query.firmSlug || req.params.firmSlug;
    
    if (!firmSlug) {
      // No firmSlug provided, continue without firm context
      return next();
    }
    
    const normalizedSlug = firmSlug.toLowerCase().trim();
    const firm = await Firm.findOne({ firmSlug: normalizedSlug });
    
    if (firm && firm.status === 'ACTIVE') {
      req.firmSlug = normalizedSlug;
      req.firmId = firm._id;
      req.firmIdString = firm.firmId;
      req.firmName = firm.name;
    }
    
    next();
  } catch (error) {
    // Don't fail on optional resolution
    console.warn('[FIRM_RESOLUTION] Error in optional resolution:', error);
    next();
  }
};

module.exports = {
  resolveFirmSlug,
  optionalFirmResolution,
};
