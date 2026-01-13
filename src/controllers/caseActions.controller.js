const Case = require('../models/Case.model');
const caseActionService = require('../services/caseAction.service');
const { CASE_STATUS } = require('../config/constants');
const { logCaseListViewed } = require('../services/auditLog.service');
const { wrapWriteHandler } = require('../utils/transactionGuards');

/**
 * Case Actions Controller
 * 
 * Handles case lifecycle actions with mandatory comments:
 * - RESOLVE: Complete a case
 * - PEND: Temporarily pause a case
 * - FILE: Archive a case
 * 
 * All actions require mandatory comments and use xID-based attribution.
 * 
 * PR: Case Lifecycle & Dashboard Logic
 */

/**
 * Resolve a case
 * POST /api/cases/:caseId/resolve
 * 
 * Changes case status to RESOLVED with mandatory comment.
 * 
 * Request body:
 * - comment: Mandatory resolution comment
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
const resolveCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comment } = req.body;
    
    // Validate user authentication
    if (!req.user || !req.user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Call service to resolve case - with firm scoping
    const caseData = await caseActionService.resolveCase(req.user.firmId, caseId, comment, req.user);
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case resolved successfully',
    });
  } catch (error) {
    // Handle specific errors
    if (error.message === 'Comment is mandatory for this action') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.message === 'Case not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.message.startsWith('Cannot change case from')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error resolving case',
      error: error.message,
    });
  }
};

/**
 * Pend a case
 * POST /api/cases/:caseId/pend
 * 
 * Changes case status to PENDED with mandatory comment and reopenDate.
 * Case disappears from My Worklist but appears in My Pending Cases dashboard.
 * 
 * Request body:
 * - comment: Mandatory pending comment
 * - reopenDate: Date (YYYY-MM-DD format) when case should auto-reopen (required)
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
const pendCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comment, reopenDate } = req.body;
    
    // Validate user authentication
    if (!req.user || !req.user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Call service to pend case - with firm scoping
    const caseData = await caseActionService.pendCase(req.user.firmId, caseId, comment, reopenDate, req.user);
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case pended successfully',
    });
  } catch (error) {
    // Handle specific errors
    if (error.message === 'Comment is mandatory for this action' ||
        error.message === 'Reopen date is required') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.message === 'Case not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.message.startsWith('Cannot change case from')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error pending case',
      error: error.message,
    });
  }
};

/**
 * File a case
 * POST /api/cases/:caseId/file
 * 
 * Changes case status to FILED with mandatory comment.
 * Case becomes read-only and is hidden from employee dashboards/worklists.
 * Only admins can see filed cases.
 * 
 * Request body:
 * - comment: Mandatory filing comment
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
const fileCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    const { comment } = req.body;
    
    // Validate user authentication
    if (!req.user || !req.user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Call service to file case - with firm scoping
    const caseData = await caseActionService.fileCase(req.user.firmId, caseId, comment, req.user);
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case filed successfully',
    });
  } catch (error) {
    // Handle specific errors
    if (error.message === 'Comment is mandatory for this action') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.message === 'Case not found') {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    
    if (error.message.startsWith('Cannot change case from')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error filing case',
      error: error.message,
    });
  }
};

/**
 * Get pending cases for current user
 * GET /api/cases/my-pending
 * 
 * Returns all cases that:
 * - Are assigned to current user's xID
 * - Have status = PENDED
 * 
 * This is the "My Pending Cases" dashboard query.
 * 
 * Before returning results, auto-reopens any cases where pendingUntil has elapsed.
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
const getMyPendingCases = async (req, res) => {
  try {
    // Validate user authentication
    if (!req.user || !req.user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // Auto-reopen expired pending cases for this user
    await caseActionService.autoReopenExpiredPendingCases(req.user.xID, req.firmId);
    
    // CANONICAL QUERY for "My Pending Cases"
    // A case appears here if it's assigned to me AND has PENDED status
    // We do NOT filter by pendedByXID - any pended case assigned to me should appear
    const query = {
      firmId: req.firmId,
      assignedToXID: req.user.xID,
      status: CASE_STATUS.PENDED,
    };
    
    // Apply client access filter from middleware (restrictedClientIds)
    if (req.clientAccessFilter) {
      Object.assign(query, req.clientAccessFilter);
    }
    
    const cases = await Case.find(query)
      .select('caseId caseName category createdAt updatedAt status clientId clientName pendingUntil')
      .sort({ pendingUntil: 1 }) // Sort by pending deadline (earliest first)
      .lean();
    
    // Log case list view for audit
    await logCaseListViewed({
      viewerXID: req.user.xID,
      filters: { status: CASE_STATUS.PENDED },
      listType: 'MY_PENDING_CASES',
      resultCount: cases.length,
    });
    
    res.json({
      success: true,
      data: cases.map(c => ({
        _id: c._id,
        caseId: c.caseId,
        caseName: c.caseName,
        category: c.category,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        status: c.status,
        clientId: c.clientId || null,
        clientName: c.clientName,
        pendingUntil: c.pendingUntil,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending cases',
      error: error.message,
    });
  }
};

/**
 * Get resolved cases for current user
 * GET /api/cases/my-resolved
 * 
 * Returns all cases that:
 * - Were resolved by current user (lastActionByXID = userXID)
 * - Have status = RESOLVED
 * 
 * This is the "My Resolved Cases" dashboard query.
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
const getMyResolvedCases = async (req, res) => {
  try {
    // Validate user authentication
    if (!req.user || !req.user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // CANONICAL QUERY for "My Resolved Cases"
    // Cases that were resolved by this user
    const query = {
      firmId: req.firmId,
      status: CASE_STATUS.RESOLVED,
      lastActionByXID: req.user.xID,
    };
    
    // Apply client access filter from middleware (restrictedClientIds)
    if (req.clientAccessFilter) {
      Object.assign(query, req.clientAccessFilter);
    }
    
    const cases = await Case.find(query)
      .select('caseId caseName category createdAt updatedAt status clientId clientName lastActionAt')
      .sort({ lastActionAt: -1 }) // Sort by resolution date (most recent first)
      .lean();
    
    // Log case list view for audit
    await logCaseListViewed({
      viewerXID: req.user.xID,
      filters: { status: CASE_STATUS.RESOLVED, lastActionByXID: req.user.xID },
      listType: 'MY_RESOLVED_CASES',
      resultCount: cases.length,
    });
    
    res.json({
      success: true,
      data: cases.map(c => ({
        _id: c._id,
        caseId: c.caseId,
        caseName: c.caseName,
        category: c.category,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        status: c.status,
        clientId: c.clientId || null,
        clientName: c.clientName,
        lastActionAt: c.lastActionAt,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching resolved cases',
      error: error.message,
    });
  }
};

/**
 * Trigger auto-reopen for pended cases (Admin/System endpoint)
 * POST /api/cases/auto-reopen-pended
 * 
 * Authorization: Handled by AdminPolicy.isAdmin guard at route level
 * 
 * Finds all PENDED cases where pendingUntil has passed and reopens them.
 * Should be called by a scheduler or admin.
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
const triggerAutoReopen = async (req, res) => {
  try {
    const result = await caseActionService.autoReopenPendedCases(req.firmId);
    
    res.json({
      success: true,
      data: result,
      message: `Auto-reopened ${result.count} case(s)`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error triggering auto-reopen',
      error: error.message,
    });
  }
};

/**
 * Get unassigned cases created by current user
 * GET /api/cases/my-unassigned-created
 * 
 * Returns all cases that:
 * - Were created by current user (createdByXID = userXID)
 * - Have status = UNASSIGNED
 * - Are still in the global worklist (not yet assigned)
 * 
 * This is the "Cases Created by Me (Unassigned)" dashboard query.
 * PR: Fix Case Visibility - New endpoint for dashboard accuracy
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
const getMyUnassignedCreatedCases = async (req, res) => {
  try {
    // Validate user authentication
    if (!req.user || !req.user.xID) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }
    
    // CANONICAL QUERY for "Cases Created by Me (Unassigned)"
    // Cases that were created by this user and are still unassigned
    const query = {
      firmId: req.firmId,
      status: CASE_STATUS.UNASSIGNED,
      createdByXID: req.user.xID,
    };
    
    // Apply client access filter from middleware (restrictedClientIds)
    if (req.clientAccessFilter) {
      Object.assign(query, req.clientAccessFilter);
    }
    
    const cases = await Case.find(query)
      .select('caseId caseName category createdAt updatedAt status clientId clientName slaDueDate')
      .sort({ createdAt: -1 }) // Sort by creation date (most recent first)
      .lean();
    
    // Log case list view for audit
    await logCaseListViewed({
      viewerXID: req.user.xID,
      filters: { status: CASE_STATUS.UNASSIGNED, createdByXID: req.user.xID },
      listType: 'MY_UNASSIGNED_CREATED_CASES',
      resultCount: cases.length,
    });
    
    res.json({
      success: true,
      data: cases.map(c => ({
        _id: c._id,
        caseId: c.caseId,
        caseName: c.caseName,
        category: c.category,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        status: c.status,
        clientId: c.clientId || null,
        clientName: c.clientName,
        slaDueDate: c.slaDueDate,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching unassigned created cases',
      error: error.message,
    });
  }
};

module.exports = {
  resolveCase: wrapWriteHandler(resolveCase),
  pendCase: wrapWriteHandler(pendCase),
  fileCase: wrapWriteHandler(fileCase),
  getMyPendingCases: wrapWriteHandler(getMyPendingCases),
  getMyResolvedCases,
  getMyUnassignedCreatedCases,
  triggerAutoReopen: wrapWriteHandler(triggerAutoReopen),
};
