const Case = require('../models/Case.model');
const Comment = require('../models/Comment.model');
const CaseHistory = require('../models/CaseHistory.model');
const CaseAudit = require('../models/CaseAudit.model');
const { CASE_STATUS } = require('../config/constants');

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
  
  // Cannot resolve already resolved cases
  if (caseData.status === CASE_STATUS.RESOLVED) {
    throw new Error('Case is already resolved');
  }
  
  // Store previous status for audit
  const previousStatus = caseData.status;
  
  // Update case status and metadata
  caseData.status = CASE_STATUS.RESOLVED;
  caseData.lastActionByXID = user.xID;
  caseData.lastActionAt = new Date();
  
  await caseData.save();
  
  // Add comment
  await Comment.create({
    caseId,
    text: comment,
    createdBy: user.email.toLowerCase(),
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
 * Changes case status to PENDED with mandatory comment and pendingUntil date.
 * Case disappears from My Worklist but appears in My Pending Cases dashboard.
 * 
 * @param {string} caseId - Case identifier
 * @param {string} comment - Mandatory pending comment
 * @param {Date} pendingUntil - Date when case should auto-reopen
 * @param {object} user - User object with xID and email
 * @returns {object} Updated case
 * @throws {Error} If comment or pendingUntil is missing, or case not found
 */
const pendCase = async (caseId, comment, pendingUntil, user) => {
  validateComment(comment);
  
  if (!pendingUntil) {
    throw new Error('pendingUntil date is required when pending a case');
  }
  
  const caseData = await Case.findOne({ caseId });
  
  if (!caseData) {
    throw new Error('Case not found');
  }
  
  // Cannot pend already pended cases
  if (caseData.status === CASE_STATUS.PENDED) {
    throw new Error('Case is already pended');
  }
  
  // Store previous status for audit
  const previousStatus = caseData.status;
  
  // Update case status and metadata
  caseData.status = CASE_STATUS.PENDED;
  caseData.pendedByXID = user.xID;
  caseData.pendingUntil = new Date(pendingUntil);
  caseData.lastActionByXID = user.xID;
  caseData.lastActionAt = new Date();
  
  await caseData.save();
  
  // Add comment
  await Comment.create({
    caseId,
    text: comment,
    createdBy: user.email.toLowerCase(),
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
  
  // Cannot file already filed cases
  if (caseData.status === CASE_STATUS.FILED) {
    throw new Error('Case is already filed');
  }
  
  // Store previous status for audit
  const previousStatus = caseData.status;
  
  // Update case status and metadata
  caseData.status = CASE_STATUS.FILED;
  caseData.lastActionByXID = user.xID;
  caseData.lastActionAt = new Date();
  
  await caseData.save();
  
  // Add comment
  await Comment.create({
    caseId,
    text: comment,
    createdBy: user.email.toLowerCase(),
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
