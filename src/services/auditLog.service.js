const CaseAudit = require('../models/CaseAudit.model');
const CaseHistory = require('../models/CaseHistory.model');
const { CASE_ACTION_TYPES } = require('../config/constants');

/**
 * Audit Logging Service
 * 
 * Provides reusable helpers for logging case-related actions.
 * All case access must be logged through this service.
 * 
 * PR: Clickable Dashboard KPI Cards & Mandatory Audit Logging
 * PR: Comprehensive CaseHistory & Audit Trail - Enhanced with full audit support
 */

/**
 * Extract IP address from request object
 * Handles proxies and load balancers
 */
const getIpAddress = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         'unknown';
};

/**
 * Extract user agent from request object
 */
const getUserAgent = (req) => {
  return req.headers['user-agent'] || 'unknown';
};

/**
 * Map role string to standardized format
 */
const mapActorRole = (role) => {
  if (!role) return 'USER';
  
  const upperRole = role.toUpperCase();
  if (upperRole === 'SUPER_ADMIN' || upperRole === 'SUPERADMIN') return 'SUPER_ADMIN';
  if (upperRole === 'ADMIN') return 'ADMIN';
  if (upperRole === 'SYSTEM') return 'SYSTEM';
  return 'USER'; // Employee or default
};

/**
 * Log to CaseHistory with comprehensive audit fields
 * 
 * PR: Comprehensive CaseHistory & Audit Trail
 * Enhanced unified logging service for all case actions
 * 
 * @param {Object} options
 * @param {string} options.caseId - Case identifier
 * @param {string} options.firmId - Firm identifier (required for tenant-scoping)
 * @param {string} options.actionType - Type of action (from CASE_ACTION_TYPES)
 * @param {string} options.actionLabel - Human-readable summary
 * @param {string} options.description - Detailed description
 * @param {string} options.performedByXID - xID of user performing action
 * @param {string} options.performedBy - Email of user (for backward compatibility)
 * @param {string} options.actorRole - Role of actor (SUPER_ADMIN | ADMIN | USER | SYSTEM)
 * @param {Object} options.metadata - Additional context (optional, must be JSON-safe)
 * @param {Object} options.req - Express request object (for IP and user agent)
 * @returns {Promise<Object>} Created history entry
 */
const logCaseHistory = async ({ 
  caseId, 
  firmId,
  actionType, 
  actionLabel,
  description, 
  performedBy, 
  performedByXID,
  actorRole,
  metadata = {},
  req,
  session
}) => {
  try {
    // Validate required fields
    if (!caseId || !actionType || !description) {
      console.error('[AUDIT] Missing required fields for case history:', { caseId, actionType });
      if (session) {
        throw new Error('Missing required fields for case history');
      }
      return null; // Don't throw - audit failures shouldn't block operations
    }
    
    // Validate firmId is provided
    if (!firmId) {
      console.error('[AUDIT] firmId is required for case history');
      if (session) {
        throw new Error('firmId is required for case history');
      }
      return null; // Don't throw - audit failures shouldn't block operations
    }
    
    // Build history entry
    const historyEntry = {
      caseId,
      firmId,
      actionType,
      actionLabel: actionLabel || description,
      description,
      performedBy: performedBy ? performedBy.toLowerCase() : 'SYSTEM',
      performedByXID: performedByXID ? performedByXID.toUpperCase() : 'SYSTEM',
      actorRole: mapActorRole(actorRole),
      metadata,
    };
    
    // Add IP and user agent if request object provided
    if (req) {
      historyEntry.ipAddress = getIpAddress(req);
      historyEntry.userAgent = getUserAgent(req);
    }

    if (session) {
      const entry = await CaseHistory.create(historyEntry, { session });
      return entry || null;
    }

    return await CaseHistory.create(historyEntry);
  } catch (error) {
    console.error('[AUDIT] Failed to create case history entry:', error.message);
    if (session) {
      throw error;
    }
    // Don't throw - history logging is supplementary and must not block operations
    return null;
  }
};

/**
 * Log a case action to CaseAudit
 * 
 * @param {Object} options
 * @param {string} options.caseId - Case identifier
 * @param {string} options.actionType - Type of action (from CaseAudit enum)
 * @param {string} options.description - Human-readable description
 * @param {string} options.performedByXID - xID of user performing action
 * @param {Object} options.metadata - Additional context (optional)
 * @returns {Promise<Object>} Created audit entry
 */
const logCaseAction = async ({ caseId, actionType, description, performedByXID, metadata = {} }) => {
  try {
    // Validate required fields
    if (!caseId || !actionType || !description || !performedByXID) {
      console.error('[AUDIT] Missing required fields for audit log:', { caseId, actionType, performedByXID });
      throw new Error('Missing required fields for audit log');
    }

    // Create audit entry
    const auditEntry = await CaseAudit.create({
      caseId,
      actionType,
      description,
      performedByXID: performedByXID.toUpperCase(),
      metadata,
    });

    return auditEntry;
  } catch (error) {
    console.error('[AUDIT] Failed to create audit log:', error.message);
    throw error;
  }
};

/**
 * Log case list view (for dashboard and worklist access)
 * 
 * @param {Object} options
 * @param {string} options.viewerXID - xID of user viewing the list
 * @param {Object} options.filters - Filters applied (status, category, etc.)
 * @param {string} options.listType - Type of list (MY_WORKLIST, GLOBAL_WORKLIST, ADMIN_FILED, etc.)
 * @param {number} options.resultCount - Number of cases in the list
 * @returns {Promise<void>}
 */
const logCaseListViewed = async ({ viewerXID, filters = {}, listType, resultCount = 0 }) => {
  try {
    if (!viewerXID || !listType) {
      console.error('[AUDIT] Missing required fields for list view audit');
      return;
    }

    // Build description
    const filterDesc = Object.keys(filters).length > 0 
      ? ` with filters: ${JSON.stringify(filters)}`
      : '';
    const description = `Case list viewed (${listType})${filterDesc} - ${resultCount} result(s)`;

    // For list views, we create a single audit entry without a specific caseId
    // Use a special marker to indicate this is a list view
    await CaseAudit.create({
      caseId: `LIST_VIEW:${listType}`,
      actionType: 'CASE_LIST_VIEWED',
      description,
      performedByXID: viewerXID.toUpperCase(),
      metadata: {
        listType,
        filters,
        resultCount,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('[AUDIT] Failed to log case list view:', error.message);
    // Don't throw - list view audit failures shouldn't block the request
  }
};

/**
 * Log admin-specific actions
 * 
 * Supported action types:
 * - ADMIN_FILED_CASES_VIEWED: Admin viewing filed cases list
 * - ADMIN_APPROVAL_QUEUE_VIEWED: Admin viewing pending approval queue
 * - ADMIN_RESOLVED_CASES_VIEWED: Admin viewing resolved cases list
 * - USER_CLIENT_ACCESS_UPDATED: Admin updating user's client access restrictions
 * 
 * @param {Object} options
 * @param {string} options.adminXID - xID of admin performing action
 * @param {string} options.actionType - Type of admin action
 * @param {string} [options.targetXID] - Optional xID of user being acted upon
 * @param {Object} options.metadata - Additional context
 * @returns {Promise<void>}
 */
const logAdminAction = async ({ adminXID, actionType, targetXID, metadata = {} }) => {
  try {
    if (!adminXID || !actionType) {
      console.error('[AUDIT] Missing required fields for admin action audit');
      return;
    }

    // Build description
    let description = '';
    if (actionType === 'ADMIN_FILED_CASES_VIEWED') {
      description = `Admin ${adminXID} viewed filed cases list`;
    } else if (actionType === 'ADMIN_APPROVAL_QUEUE_VIEWED') {
      description = `Admin ${adminXID} viewed pending approval queue`;
    } else if (actionType === 'ADMIN_RESOLVED_CASES_VIEWED') {
      description = `Admin ${adminXID} viewed resolved cases list`;
    } else if (actionType === 'USER_CLIENT_ACCESS_UPDATED') {
      description = `Admin ${adminXID} updated client access restrictions for user ${targetXID}`;
    } else {
      description = `Admin ${adminXID} performed action: ${actionType}`;
    }

    await CaseAudit.create({
      caseId: `ADMIN_ACTION:${actionType}`,
      actionType,
      description,
      performedByXID: adminXID.toUpperCase(),
      metadata: {
        ...metadata,
        targetXID,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('[AUDIT] Failed to log admin action:', error.message);
    // Don't throw - audit failures shouldn't block the request
  }
};

module.exports = {
  logCaseAction,
  logCaseListViewed,
  logAdminAction,
  logCaseHistory,
  getIpAddress,
  getUserAgent,
  mapActorRole,
};
