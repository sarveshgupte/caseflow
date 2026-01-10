const { logCaseHistory } = require('../services/auditLog.service');
const { CASE_ACTION_TYPES } = require('../config/constants');
const Case = require('../models/Case.model');
const CaseHistory = require('../models/CaseHistory.model');

/**
 * Case Tracking Controller
 * 
 * PR: Comprehensive CaseHistory & Audit Trail
 * Handles tracking of case views, opens, and exits for audit purposes
 * PR: Fix Case Visibility - Added authorization checks to tracking endpoints
 */

/**
 * Check if user has access to a case
 * PR: Fix Case Visibility - Unified access control logic
 * 
 * Returns true if user can access the case:
 * - Admin or SuperAdmin: Can access any case in their firm
 * - Creator: Can access cases they created
 * - Assignee: Can access cases assigned to them
 * 
 * @param {Object} caseData - Case document from database
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if user has access, false otherwise
 */
const checkCaseAccess = (caseData, user) => {
  if (!caseData || !user) {
    return false;
  }
  
  const isAdmin = user.role === 'Admin';
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const isCreator = caseData.createdByXID === user.xID;
  const isAssignee = caseData.assignedToXID === user.xID;
  
  return isAdmin || isSuperAdmin || isCreator || isAssignee;
};

/**
 * Track case opened
 * POST /api/cases/:caseId/track-open
 * 
 * Logs when a user opens a case detail page
 * PR: Fix Case Visibility - Added authorization check
 */
const trackCaseOpen = async (req, res) => {
  try {
    const { caseId } = req.params;
    const user = req.user;
    
    if (!user || !user.xID) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }
    
    // Verify case exists - with firmId scoping for multi-tenancy
    const query = { caseId };
    if (user.firmId) {
      query.firmId = user.firmId;
    }
    const caseData = await Case.findOne(query);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check authorization - user must have access to track
    if (!checkCaseAccess(caseData, user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to access this case',
        code: 'CASE_ACCESS_DENIED',
      });
    }
    
    // Log to CaseHistory (async, non-blocking)
    const actorRole = user.role === 'Admin' ? 'ADMIN' : 
                      user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'USER';
    
    // Fire and forget - don't await
    logCaseHistory({
      caseId,
      firmId: caseData.firmId || user.firmId,
      actionType: CASE_ACTION_TYPES.CASE_OPENED,
      actionLabel: `${user.name || user.xID} opened case`,
      description: `Case opened by ${user.xID} (${user.name || 'Unknown'})`,
      performedBy: user.email,
      performedByXID: user.xID,
      actorRole,
      metadata: {
        userName: user.name,
        timestamp: new Date().toISOString(),
      },
      req,
    }).catch(err => {
      console.error('[TRACKING] Failed to log case open:', err.message);
    });
    
    // Return immediately - don't wait for logging
    return res.status(200).json({
      success: true,
      message: 'Case open tracked',
    });
  } catch (error) {
    console.error('[TRACKING] Error in trackCaseOpen:', error);
    // Never block the UI for tracking failures
    return res.status(200).json({
      success: true,
      message: 'Case open tracking attempted',
    });
  }
};

/**
 * Track case viewed
 * POST /api/cases/:caseId/track-view
 * 
 * Logs when a user actively views a case (debounced, once per session)
 * PR: Fix Case Visibility - Added authorization check
 */
const trackCaseView = async (req, res) => {
  try {
    const { caseId } = req.params;
    const user = req.user;
    
    if (!user || !user.xID) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }
    
    // Verify case exists - with firmId scoping for multi-tenancy
    const query = { caseId };
    if (user.firmId) {
      query.firmId = user.firmId;
    }
    const caseData = await Case.findOne(query);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check authorization - user must have access to track
    if (!checkCaseAccess(caseData, user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to access this case',
        code: 'CASE_ACCESS_DENIED',
      });
    }
    
    // Log to CaseHistory (async, non-blocking)
    const actorRole = user.role === 'Admin' ? 'ADMIN' : 
                      user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'USER';
    
    // Fire and forget - don't await
    logCaseHistory({
      caseId,
      firmId: caseData.firmId || user.firmId,
      actionType: CASE_ACTION_TYPES.CASE_VIEWED,
      actionLabel: `${user.name || user.xID} viewed case`,
      description: `Case viewed by ${user.xID} (${user.name || 'Unknown'})`,
      performedBy: user.email,
      performedByXID: user.xID,
      actorRole,
      metadata: {
        userName: user.name,
        timestamp: new Date().toISOString(),
      },
      req,
    }).catch(err => {
      console.error('[TRACKING] Failed to log case view:', err.message);
    });
    
    // Return immediately - don't wait for logging
    return res.status(200).json({
      success: true,
      message: 'Case view tracked',
    });
  } catch (error) {
    console.error('[TRACKING] Error in trackCaseView:', error);
    // Never block the UI for tracking failures
    return res.status(200).json({
      success: true,
      message: 'Case view tracking attempted',
    });
  }
};

/**
 * Track case exit
 * POST /api/cases/:caseId/track-exit
 * 
 * Logs when a user exits/closes a case detail page
 * PR: Fix Case Visibility - Added authorization check (lenient for deleted cases)
 */
const trackCaseExit = async (req, res) => {
  try {
    const { caseId } = req.params;
    const user = req.user;
    
    if (!user || !user.xID) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }
    
    // Verify case exists (lighter check, don't fail if case not found during exit)
    // Add firmId scoping for multi-tenancy
    const query = { caseId };
    if (user.firmId) {
      query.firmId = user.firmId;
    }
    const caseData = await Case.findOne(query).select('caseId firmId createdByXID assignedToXID');
    if (!caseData) {
      // Case might have been deleted, but still log the exit attempt
      console.warn(`[TRACKING] Case ${caseId} not found during exit tracking`);
    } else {
      // Check authorization if case exists
      if (!checkCaseAccess(caseData, user)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You do not have permission to access this case',
          code: 'CASE_ACCESS_DENIED',
        });
      }
    }
    
    // Log to CaseHistory (async, non-blocking)
    const actorRole = user.role === 'Admin' ? 'ADMIN' : 
                      user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'USER';
    
    // Fire and forget - don't await
    logCaseHistory({
      caseId,
      firmId: caseData?.firmId || user.firmId,
      actionType: CASE_ACTION_TYPES.CASE_EXITED,
      actionLabel: `${user.name || user.xID} exited case`,
      description: `Case exited by ${user.xID} (${user.name || 'Unknown'})`,
      performedBy: user.email,
      performedByXID: user.xID,
      actorRole,
      metadata: {
        userName: user.name,
        timestamp: new Date().toISOString(),
      },
      req,
    }).catch(err => {
      console.error('[TRACKING] Failed to log case exit:', err.message);
    });
    
    // Return immediately - don't wait for logging
    return res.status(200).json({
      success: true,
      message: 'Case exit tracked',
    });
  } catch (error) {
    console.error('[TRACKING] Error in trackCaseExit:', error);
    // Never block the UI for tracking failures
    return res.status(200).json({
      success: true,
      message: 'Case exit tracking attempted',
    });
  }
};

/**
 * Get case history
 * GET /api/cases/:caseId/history
 * 
 * Returns chronological audit trail for a case
 * Role-based access: Admin (full), User (read-only)
 * PR: Fix Case Visibility - Added authorization check
 */
const getCaseHistory = async (req, res) => {
  try {
    const { caseId } = req.params;
    const user = req.user;
    
    if (!user || !user.xID) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }
    
    // Superadmin should not access case history (per requirements)
    if (user.role === 'SUPER_ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Superadmin cannot access case history',
      });
    }
    
    // Verify case exists - with firmId scoping for multi-tenancy
    const query = { caseId };
    if (user.firmId) {
      query.firmId = user.firmId;
    }
    const caseData = await Case.findOne(query);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check authorization - user must have access to view history
    if (!checkCaseAccess(caseData, user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You do not have permission to view this case history',
        code: 'CASE_ACCESS_DENIED',
      });
    }
    
    // Verify firm access (additional check for non-superadmin)
    if (user.role !== 'SUPER_ADMIN' && caseData.firmId && user.firmId) {
      if (caseData.firmId.toString() !== user.firmId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Case belongs to different firm',
        });
      }
    }
    
    // Fetch history entries
    const history = await CaseHistory.find({ caseId })
      .sort({ timestamp: -1 }) // Most recent first
      .limit(200) // Reasonable limit
      .lean();
    
    // Transform for display
    const formattedHistory = history.map(entry => ({
      id: entry._id,
      actionType: entry.actionType,
      actionLabel: entry.actionLabel || entry.description,
      description: entry.description,
      actorXID: entry.performedByXID,
      actorEmail: entry.performedBy,
      actorRole: entry.actorRole || 'USER',
      timestamp: entry.timestamp,
      metadata: entry.metadata || {},
      ipAddress: user.role === 'Admin' ? entry.ipAddress : undefined, // Only show IP to admins
    }));
    
    return res.status(200).json({
      success: true,
      data: {
        caseId,
        history: formattedHistory,
        count: formattedHistory.length,
      },
    });
  } catch (error) {
    console.error('[TRACKING] Error fetching case history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch case history',
    });
  }
};

module.exports = {
  trackCaseOpen,
  trackCaseView,
  trackCaseExit,
  getCaseHistory,
};
