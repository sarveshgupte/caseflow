const CaseAudit = require('../models/CaseAudit.model');
const CaseHistory = require('../models/CaseHistory.model');

/**
 * Audit Logging Service
 * 
 * Provides reusable helpers for logging case-related actions.
 * All case access must be logged through this service.
 * 
 * PR: Clickable Dashboard KPI Cards & Mandatory Audit Logging
 */

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

/**
 * Legacy: Log to CaseHistory for backward compatibility
 * 
 * @param {Object} options
 * @param {string} options.caseId - Case identifier
 * @param {string} options.actionType - Type of action
 * @param {string} options.description - Human-readable description
 * @param {string} options.performedBy - Email of user (legacy)
 * @param {string} options.performedByXID - xID of user
 * @returns {Promise<void>}
 */
const logCaseHistory = async ({ caseId, actionType, description, performedBy, performedByXID }) => {
  try {
    if (!caseId || !actionType || !description || !performedBy || !performedByXID) {
      console.error('[AUDIT] Missing required fields for case history');
      return;
    }

    await CaseHistory.create({
      caseId,
      actionType,
      description,
      performedBy: performedBy.toLowerCase(),
      performedByXID: performedByXID.toUpperCase(),
    });
  } catch (error) {
    console.error('[AUDIT] Failed to create case history entry:', error.message);
    // Don't throw - history logging is supplementary
  }
};

module.exports = {
  logCaseAction,
  logCaseListViewed,
  logAdminAction,
  logCaseHistory,
};
