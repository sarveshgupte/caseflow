const caseActionService = require('../services/caseAction.service');
const { CASE_STATUS } = require('../config/constants');
const { logCaseListViewed } = require('../services/auditLog.service');

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
    
    // Call service to resolve case
    const caseData = await caseActionService.resolveCase(caseId, comment, req.user);
    
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
    
    // Call service to pend case
    const caseData = await caseActionService.pendCase(caseId, comment, reopenDate, req.user);
    
    res.json({
      success: true,
      data: caseData,
      message: 'Case pended successfully',
    });
  } catch (error) {
    // Handle specific errors
    if (error.message === 'Comment is mandatory for this action' ||
        error.message === 'Comment and reopen date are required') {
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
    
    // Call service to file case
    const caseData = await caseActionService.fileCase(caseId, comment, req.user);
    
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
 * - Were pended by current user's xID
 * 
 * This is the "My Pending Cases" dashboard query.
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
    
    const Case = require('../models/Case.model');
    
    // CANONICAL QUERY for "My Pending Cases"
    const query = {
      assignedToXID: req.user.xID,
      status: CASE_STATUS.PENDED,
      pendedByXID: req.user.xID,
    };
    
    const cases = await Case.find(query)
      .select('caseId caseName category createdAt updatedAt status clientId clientName pendingUntil')
      .sort({ pendingUntil: 1 }) // Sort by pending deadline (earliest first)
      .lean();
    
    // Log case list view for audit
    await logCaseListViewed({
      viewerXID: req.user.xID,
      filters: { status: CASE_STATUS.PENDED, pendedByXID: req.user.xID },
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
 * Trigger auto-reopen for pended cases (Admin/System endpoint)
 * POST /api/cases/auto-reopen-pended
 * 
 * Finds all PENDED cases where pendingUntil has passed and reopens them.
 * Should be called by a scheduler or admin.
 * 
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
const triggerAutoReopen = async (req, res) => {
  try {
    // Only admins can trigger this manually
    if (!req.user || req.user.role !== 'Admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required',
      });
    }
    
    const result = await caseActionService.autoReopenPendedCases();
    
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

module.exports = {
  resolveCase,
  pendCase,
  fileCase,
  getMyPendingCases,
  triggerAutoReopen,
};
