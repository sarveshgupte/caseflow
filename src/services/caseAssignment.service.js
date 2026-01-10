const Case = require('../models/Case.model');
const CaseHistory = require('../models/CaseHistory.model');
const CaseAudit = require('../models/CaseAudit.model');
const { CASE_STATUS, CASE_ACTION_TYPES } = require('../config/constants');
const { logCaseHistory } = require('./auditLog.service');

/**
 * Case Assignment Service
 * 
 * Provides centralized case assignment operations with:
 * - Atomic assignment (prevents race conditions)
 * - xID-based ownership
 * - Queue type management (GLOBAL → PERSONAL)
 * - Status transitions (UNASSIGNED → OPEN)
 * - Audit trail creation
 * 
 * All case assignment operations must go through this service to ensure
 * consistency and fix the worklist/dashboard mismatch.
 * 
 * PR: Case Lifecycle & Dashboard Logic
 */

/**
 * Assign a case to a user (Pull from Global Worklist)
 * 
 * Atomically assigns a case to a user with:
 * - assignedTo = userXID
 * - queueType = PERSONAL
 * - status = OPEN
 * - assignedAt = now
 * 
 * This is the CANONICAL way to pull cases from the global worklist.
 * After this operation, the case:
 * - Disappears from Global Worklist
 * - Appears in user's My Worklist
 * - Counted in user's "My Open Cases" dashboard
 * 
 * @param {string} caseId - Case identifier
 * @param {object} user - User object with xID and email
 * @returns {object} Updated case or null if already assigned
 * @throws {Error} If case not found or user invalid
 */
const assignCaseToUser = async (caseId, user) => {
  if (!user || !user.xID) {
    throw new Error('Valid user with xID is required for case assignment');
  }
  
  // Use findOneAndUpdate for atomic operation to prevent double assignment
  const caseData = await Case.findOneAndUpdate(
    {
      caseId,
      status: CASE_STATUS.UNASSIGNED, // Only assign if still unassigned
    },
    {
      $set: {
        assignedToXID: user.xID.toUpperCase(), // CANONICAL: Store xID in assignedToXID
        queueType: 'PERSONAL', // Move from GLOBAL to PERSONAL queue
        status: CASE_STATUS.OPEN, // Change status to OPEN
        assignedAt: new Date(),
        lastActionByXID: user.xID.toUpperCase(), // Track last action performer
        lastActionAt: new Date(), // Track last action timestamp
      },
    },
    {
      new: true, // Return updated document
    }
  );
  
  if (!caseData) {
    // Either case doesn't exist or is not UNASSIGNED anymore
    const existingCase = await Case.findOne({ caseId });
    
    if (!existingCase) {
      throw new Error('Case not found');
    }
    
    if (existingCase.status !== CASE_STATUS.UNASSIGNED) {
      return {
        success: false,
        message: 'Case is no longer available (already assigned)',
        currentStatus: existingCase.status,
        assignedToXID: existingCase.assignedToXID,
      };
    }
  }
  
  // Create CaseAudit entry (xID-based)
  await CaseAudit.create({
    caseId,
    actionType: CASE_ACTION_TYPES.CASE_ASSIGNED,
    description: `Case pulled from global worklist and assigned to ${user.xID}`,
    performedByXID: user.xID,
    metadata: {
      queueType: 'PERSONAL',
      status: CASE_STATUS.OPEN,
      assignedTo: user.xID,
    },
  });
  
  // Create CaseHistory entry with enhanced audit logging
  await logCaseHistory({
    caseId,
    firmId: caseData.firmId,
    actionType: CASE_ACTION_TYPES.CASE_ASSIGNED,
    actionLabel: `Case assigned to ${user.name || user.xID}`,
    description: `Case pulled from global worklist and assigned to ${user.xID}`,
    performedBy: user.email,
    performedByXID: user.xID,
    actorRole: user.role === 'Admin' ? 'ADMIN' : 'USER',
    metadata: {
      queueType: 'PERSONAL',
      status: CASE_STATUS.OPEN,
      assignedTo: user.xID,
    },
  });
  
  return {
    success: true,
    data: caseData,
  };
};

/**
 * Bulk assign multiple cases to a user
 * 
 * Atomically assigns multiple cases with race safety.
 * Uses updateMany with atomic filter to prevent double assignment.
 * 
 * @param {string[]} caseIds - Array of case identifiers
 * @param {object} user - User object with xID and email
 * @returns {object} Results with count of assigned cases
 */
const bulkAssignCasesToUser = async (caseIds, user) => {
  if (!user || !user.xID) {
    throw new Error('Valid user with xID is required for case assignment');
  }
  
  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    throw new Error('Case IDs array is required and must not be empty');
  }
  
  // Atomic bulk update - only updates cases that are still UNASSIGNED
  const result = await Case.updateMany(
    {
      caseId: { $in: caseIds },
      status: CASE_STATUS.UNASSIGNED,
    },
    {
      $set: {
        assignedToXID: user.xID.toUpperCase(), // CANONICAL: Store xID in assignedToXID
        queueType: 'PERSONAL', // Move from GLOBAL to PERSONAL queue
        status: CASE_STATUS.OPEN, // Change status to OPEN
        assignedAt: new Date(),
        lastActionByXID: user.xID.toUpperCase(), // Track last action performer
        lastActionAt: new Date(), // Track last action timestamp
      },
    }
  );
  
  // Get the actual cases that were updated
  const updatedCases = await Case.find({
    caseId: { $in: caseIds },
    assignedToXID: user.xID.toUpperCase(),
    queueType: 'PERSONAL',
  });
  
  // Create audit entries for successfully assigned cases
  const auditEntries = updatedCases.map(caseData => ({
    caseId: caseData.caseId,
    actionType: 'CASE_ASSIGNED',
    description: `Case bulk-assigned to ${user.xID}`,
    performedByXID: user.xID,
    metadata: {
      queueType: 'PERSONAL',
      status: CASE_STATUS.OPEN,
      bulkAssignment: true,
    },
  }));
  
  if (auditEntries.length > 0) {
    await CaseAudit.insertMany(auditEntries);
  }
  
  // Create history entries for backward compatibility
  const historyEntries = updatedCases.map(caseData => ({
    caseId: caseData.caseId,
    actionType: 'CASE_ASSIGNED',
    description: `Case bulk-assigned to ${user.xID}`,
    performedBy: user.email.toLowerCase(),
    performedByXID: user.xID.toUpperCase(), // Canonical identifier (uppercase)
  }));
  
  if (historyEntries.length > 0) {
    await CaseHistory.insertMany(historyEntries);
  }
  
  return {
    success: true,
    assigned: result.modifiedCount,
    requested: caseIds.length,
    cases: updatedCases,
  };
};

/**
 * Reassign a case to a different user
 * 
 * Changes case assignment from one user to another.
 * Only works if case is currently assigned (not UNASSIGNED).
 * 
 * @param {string} caseId - Case identifier
 * @param {string} newUserXID - xID of new assignee
 * @param {object} performedBy - User object performing the reassignment
 * @returns {object} Updated case
 * @throws {Error} If case not found or cannot be reassigned
 */
const reassignCase = async (caseId, newUserXID, performedBy) => {
  if (!newUserXID || !/^X\d{6}$/i.test(newUserXID)) {
    throw new Error('Valid xID is required for reassignment (format: X123456)');
  }
  
  const caseData = await Case.findOne({ caseId });
  
  if (!caseData) {
    throw new Error('Case not found');
  }
  
  // Cannot reassign unassigned cases
  if (caseData.status === CASE_STATUS.UNASSIGNED) {
    throw new Error('Cannot reassign unassigned cases. Use assignment instead.');
  }
  
  // Cannot reassign filed cases
  if (caseData.status === CASE_STATUS.FILED) {
    throw new Error('Cannot reassign filed cases');
  }
  
  const previousAssignee = caseData.assignedToXID;
  
  // Update assignment
  caseData.assignedToXID = newUserXID.toUpperCase();
  caseData.assignedAt = new Date();
  
  await caseData.save();
  
  // Create audit entry
  await CaseAudit.create({
    caseId,
    actionType: 'CASE_REASSIGNED',
    description: `Case reassigned from ${previousAssignee || 'unassigned'} to ${newUserXID} by ${performedBy.xID}`,
    performedByXID: performedBy.xID,
    metadata: {
      previousAssignee,
      newAssignee: newUserXID,
    },
  });
  
  // Create history entry
  await CaseHistory.create({
    caseId,
    actionType: 'CASE_REASSIGNED',
    description: `Case reassigned from ${previousAssignee || 'unassigned'} to ${newUserXID}`,
    performedBy: performedBy.email.toLowerCase(),
    performedByXID: performedBy.xID.toUpperCase(), // Canonical identifier (uppercase)
  });
  
  return caseData;
};

module.exports = {
  assignCaseToUser,
  bulkAssignCasesToUser,
  reassignCase,
};
