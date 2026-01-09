const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const CaseHistory = require('../models/CaseHistory.model');
const CaseAudit = require('../models/CaseAudit.model');
const { CASE_STATUS } = require('../config/constants');
const { DateTime } = require('luxon');

/**
 * Case Action Service
 * 
 * Provides centralized case action operations with:
 * - Mandatory comment enforcement
 * - Audit trail creation
 * - Status transition validation
 * - xID-based attribution
 * 
 * All case actions (RESOLVE, PEND, FILE) must go through this service
 * to ensure consistency and auditability.
 * 
 * PR: Case Lifecycle & Dashboard Logic
 */

/**
 * Central state transition map
 * Defines which status transitions are allowed
 * 
 * Terminal states (FILED, RESOLVED) cannot transition to any other state
 * PENDED/PENDING states cannot transition (must wait for auto-reopen)
 * 
 * Note: Both PENDING and PENDED are mapped because the codebase uses PENDED
 * as the canonical status, but PENDING may exist for legacy compatibility
 */
const CASE_TRANSITIONS = {
  OPEN: ['PENDED', 'FILED', 'RESOLVED'],
  PENDING: [], // Legacy status - no transitions allowed
  PENDED: [], // Canonical status - no transitions allowed  
  FILED: [], // Terminal state
  RESOLVED: [], // Terminal state
  UNASSIGNED: ['OPEN', 'PENDED', 'FILED', 'RESOLVED'], // Allow actions from unassigned state
};

/**
 * Assert that a case state transition is valid
 * @param {string} currentStatus - Current case status
 * @param {string} targetStatus - Desired target status
 * @throws {Error} If transition is not allowed
 */
const assertCaseTransition = (currentStatus, targetStatus) => {
  const allowedTransitions = CASE_TRANSITIONS[currentStatus];
  
  if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
    throw new Error(`Cannot change case from ${currentStatus} to ${targetStatus}`);
  }
};

/**
 * Validate that a comment is provided and not empty
 * @param {string} comment - The comment text
 * @throws {Error} If comment is missing or empty
 */
const validateComment = (comment) => {
  if (!comment || comment.trim() === '') {
    throw new Error('Comment is mandatory for this action');
  }
};

/**
 * Record case action in audit trail
 * Creates entries in both CaseHistory (legacy) and CaseAudit (new)
 * 
 * @param {string} caseId - Case identifier
 * @param {string} actionType - Type of action (RESOLVED, PENDED, FILED, etc.)
 * @param {string} description - Action description
 * @param {string} performedByXID - xID of user performing action
 * @param {string} performedByEmail - Email of user (for legacy CaseHistory)
 * @param {object} metadata - Additional metadata for audit log
 */
const recordAction = async (caseId, actionType, description, performedByXID, performedByEmail, metadata = {}) => {
  // Create CaseAudit entry (new, xID-based)
  await CaseAudit.create({
    caseId,
    actionType,
    description,
    performedByXID,
    metadata,
  });
  
  // Create CaseHistory entry (legacy, email-based, now with xID too)
  await CaseHistory.create({
    caseId,
    actionType,
    description,
    performedBy: performedByEmail.toLowerCase(),
    performedByXID: performedByXID.toUpperCase(), // Canonical identifier (uppercase)
  });
};

/**
 * Resolve a case
 * 
 * Changes case status to RESOLVED with mandatory comment.
 * 
 * @param {string} caseId - Case identifier
 * @param {string} comment - Mandatory resolution comment
 * @param {object} user - User object with xID and email
 * @returns {object} Updated case
 * @throws {Error} If comment is missing or case not found
 */
const resolveCase = async (caseId, comment, user) => {
  validateComment(comment);
  
  const caseData = await Case.findOne({ caseId });
  
  if (!caseData) {
    throw new Error('Case not found');
  }
  
  // Validate state transition
  assertCaseTransition(caseData.status, CASE_STATUS.RESOLVED);
  
  // Store previous status for audit
  const previousStatus = caseData.status;
  
  // Update case status and metadata
  caseData.status = CASE_STATUS.RESOLVED;
  caseData.pendingUntil = null; // Clear pending date
  caseData.lastActionByXID = user.xID;
  caseData.lastActionAt = new Date();
  
  await caseData.save();
  
  // Add comment
  await Comment.create({
    caseId,
    text: comment,
    createdBy: user.email.toLowerCase(),
    createdByXID: user.xID,
    createdByName: user.name,
    note: 'Case resolution comment',
  });
  
  // Record action in audit trail
  await recordAction(
    caseId,
    'CASE_RESOLVED',
    `Case resolved by ${user.xID}. Previous status: ${previousStatus}`,
    user.xID,
    user.email,
    {
      previousStatus,
      newStatus: CASE_STATUS.RESOLVED,
      commentLength: comment.length,
    }
  );
  
  return caseData;
};

/**
 * Pend a case
 * 
 * Changes case status to PENDED with mandatory comment and reopenDate.
 * Case disappears from My Worklist but appears in My Pending Cases dashboard.
 * 
 * Backend normalizes reopenDate to 8:00 AM IST regardless of input time.
 * 
 * @param {string} caseId - Case identifier
 * @param {string} comment - Mandatory pending comment
 * @param {string} reopenDate - Date (YYYY-MM-DD format) when case should auto-reopen
 * @param {object} user - User object with xID and email
 * @returns {object} Updated case
 * @throws {Error} If comment or reopenDate is missing, or case not found
 */
const pendCase = async (caseId, comment, reopenDate, user) => {
  validateComment(comment);
  
  if (!reopenDate) {
    throw new Error('Reopen date is required');
  }
  
  const caseData = await Case.findOne({ caseId });
  
  if (!caseData) {
    throw new Error('Case not found');
  }
  
  // Validate state transition
  assertCaseTransition(caseData.status, CASE_STATUS.PENDED);
  
  // Store previous status for audit
  const previousStatus = caseData.status;
  
  // Convert reopenDate to 8:00 AM IST and then to UTC
  const pendingUntil = DateTime
    .fromISO(reopenDate, { zone: 'Asia/Kolkata' })
    .set({ hour: 8, minute: 0, second: 0, millisecond: 0 })
    .toUTC()
    .toJSDate();
  
  // Update case status and metadata
  caseData.status = CASE_STATUS.PENDED;
  caseData.pendedByXID = user.xID;
  caseData.pendingUntil = pendingUntil;
  caseData.lastActionByXID = user.xID;
  caseData.lastActionAt = new Date();
  
  await caseData.save();
  
  // Add comment
  await Comment.create({
    caseId,
    text: comment,
    createdBy: user.email.toLowerCase(),
    createdByXID: user.xID,
    createdByName: user.name,
    note: 'Case pending comment',
  });
  
  // Record action in audit trail
  await recordAction(
    caseId,
    'CASE_PENDED',
    `Case pended by ${user.xID} until ${pendingUntil}. Previous status: ${previousStatus}`,
    user.xID,
    user.email,
    {
      previousStatus,
      newStatus: CASE_STATUS.PENDED,
      pendingUntil,
      commentLength: comment.length,
    }
  );
  
  return caseData;
};

/**
 * File a case
 * 
 * Changes case status to FILED with mandatory comment.
 * Case becomes read-only and is hidden from employee dashboards/worklists.
 * Only admins can see filed cases.
 * 
 * @param {string} caseId - Case identifier
 * @param {string} comment - Mandatory filing comment
 * @param {object} user - User object with xID and email
 * @returns {object} Updated case
 * @throws {Error} If comment is missing or case not found
 */
const fileCase = async (caseId, comment, user) => {
  validateComment(comment);
  
  const caseData = await Case.findOne({ caseId });
  
  if (!caseData) {
    throw new Error('Case not found');
  }
  
  // Validate state transition
  assertCaseTransition(caseData.status, CASE_STATUS.FILED);
  
  // Store previous status for audit
  const previousStatus = caseData.status;
  
  // Update case status and metadata
  caseData.status = CASE_STATUS.FILED;
  caseData.pendingUntil = null; // Clear pending date
  caseData.lastActionByXID = user.xID;
  caseData.lastActionAt = new Date();
  
  await caseData.save();
  
  // Add comment
  await Comment.create({
    caseId,
    text: comment,
    createdBy: user.email.toLowerCase(),
    createdByXID: user.xID,
    createdByName: user.name,
    note: 'Case filing comment',
  });
  
  // Record action in audit trail
  await recordAction(
    caseId,
    'CASE_FILED',
    `Case filed by ${user.xID}. Previous status: ${previousStatus}`,
    user.xID,
    user.email,
    {
      previousStatus,
      newStatus: CASE_STATUS.FILED,
      commentLength: comment.length,
    }
  );
  
  return caseData;
};

/**
 * Auto-reopen pended cases
 * 
 * Finds all cases with status PENDED where pendingUntil <= now
 * and changes their status back to OPEN.
 * 
 * This should be called by a scheduler (cron job) periodically.
 * 
 * @returns {object} Results with count of reopened cases
 */
const autoReopenPendedCases = async () => {
  const now = new Date();
  
  // Find all pended cases where pendingUntil has passed
  const pendedCases = await Case.find({
    status: CASE_STATUS.PENDED,
    pendingUntil: { $lte: now },
  });
  
  const reopenedCases = [];
  
  for (const caseData of pendedCases) {
    const previousStatus = caseData.status;
    
    // Update status back to OPEN
    caseData.status = CASE_STATUS.OPEN;
    caseData.lastActionByXID = 'SYSTEM'; // System auto-reopen
    caseData.lastActionAt = new Date();
    
    await caseData.save();
    
    // Add system comment
    await Comment.create({
      caseId: caseData.caseId,
      text: `Case automatically reopened after pending period expired (pending until: ${caseData.pendingUntil})`,
      createdBy: 'system',
      note: 'Auto-reopen system action',
    });
    
    // Record action in audit trail
    await recordAction(
      caseData.caseId,
      'CASE_AUTO_REOPENED',
      `Case automatically reopened by system. Previous status: ${previousStatus}. Was pended until: ${caseData.pendingUntil}`,
      'SYSTEM',
      'system',
      {
        previousStatus,
        newStatus: CASE_STATUS.OPEN,
        pendingUntil: caseData.pendingUntil,
        autoReopened: true,
      }
    );
    
    reopenedCases.push(caseData.caseId);
  }
  
  return {
    success: true,
    count: reopenedCases.length,
    cases: reopenedCases,
  };
};

module.exports = {
  resolveCase,
  pendCase,
  fileCase,
  autoReopenPendedCases,
  validateComment,
  recordAction,
};
