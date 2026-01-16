const { randomUUID } = require('crypto');
const mongoose = require('mongoose');
const Firm = require('../models/Firm.model');
const { isSuperAdminRole } = require('../utils/role.utils');

/**
 * Firm Context Middleware (single source of truth)
 * - Extracts firmId/firmSlug from JWT, session, or path params
 * - Blocks SuperAdmin from firm-scoped routes
 * - Asserts firmId presence for non-superadmin requests
 * - Attaches req.firmId and req.firmSlug
 */
const firmContext = async (req, res, next) => {
  const requestId = req.requestId || randomUUID();
  req.requestId = requestId;

  try {
    if (req.skipFirmContext) {
      return next();
    }
    const isSuperAdmin = req.user && isSuperAdminRole(req.user.role);
    req.isSuperAdmin = isSuperAdmin;

    if (isSuperAdmin) {
      console.warn(`[FIRM_CONTEXT][${requestId}] SuperAdmin boundary violation on ${req.method} ${req.originalUrl}`);
      return res.status(403).json({
        success: false,
        message: 'Superadmin cannot access firm-scoped routes',
      });
    }

    const normalizeSlug = (slug) => (slug ? slug.toLowerCase().trim() : null);

    const paramFirmId = req.params?.firmId;
    const paramFirmSlug = normalizeSlug(req.params?.firmSlug);
    const jwtFirmId = req.jwt?.firmId;
    const sessionFirmId = req.user?.firmId;

    const lookup = [];

    if (paramFirmSlug) {
      lookup.push({ firmSlug: paramFirmSlug });
    }

    if (paramFirmId) {
      if (/^FIRM\d{3,}$/i.test(paramFirmId)) {
        lookup.push({ firmId: paramFirmId.toUpperCase() });
      }
      if (mongoose.Types.ObjectId.isValid(paramFirmId)) {
        lookup.push({ _id: paramFirmId });
      }
    }

    if (jwtFirmId && mongoose.Types.ObjectId.isValid(jwtFirmId)) {
      lookup.push({ _id: jwtFirmId });
    }

    if (sessionFirmId && mongoose.Types.ObjectId.isValid(sessionFirmId)) {
      lookup.push({ _id: sessionFirmId });
    }

    const firm = lookup.length > 0 ? await Firm.findOne({ $or: lookup }) : null;

    if (!firm) {
      console.error(`[FIRM_CONTEXT][${requestId}] Firm context missing or unresolved`, {
        path: req.originalUrl,
        jwtFirmId: jwtFirmId || null,
        paramFirmId: paramFirmId || null,
        paramFirmSlug: paramFirmSlug || null,
      });
      const error = new Error('Firm context missing');
      error.statusCode = 400;
      throw error;
    }

    if (firm.status !== 'ACTIVE') {
      console.warn(`[FIRM_CONTEXT][${requestId}] Firm disabled`, { firmId: firm._id.toString(), status: firm.status });
      return res.status(403).json({
        success: false,
        message: 'Firm is disabled. Please contact support.',
      });
    }

    if (jwtFirmId && firm._id.toString() !== jwtFirmId.toString()) {
      console.error(`[FIRM_CONTEXT][${requestId}] Firm mismatch detected`, {
        tokenFirmId: jwtFirmId,
        resolvedFirmId: firm._id.toString(),
      });
      return res.status(403).json({
        success: false,
        message: 'Firm mismatch detected for authenticated user',
      });
    }

    req.firm = {
      id: firm._id.toString(),
      slug: firm.firmSlug,
      status: firm.status,
    };
    req.firmId = firm._id.toString();
    req.firmSlug = firm.firmSlug;

    console.log(`[FIRM_CONTEXT][${requestId}] Firm context resolved`, { firmId: req.firmId, firmSlug: req.firmSlug });
    return next();
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error(`[FIRM_CONTEXT][${requestId}] Error attaching firm context:`, error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode === 400 ? 'Firm context missing' : 'Failed to resolve firm context',
      error: error.message,
    });
  }
};

module.exports = {
  firmContext,
};
