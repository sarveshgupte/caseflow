const Case = require('../models/Case.model');

/**
 * Case Lock Middleware
 * 
 * Provides concurrency control to prevent multiple users from 
 * modifying the same case simultaneously.
 * 
 * Usage:
 * - Apply this middleware to routes that modify case data
 * - Pass userEmail in request body or from authentication
 */

/**
 * Check if a case is locked by another user
 * Returns 409 Conflict if case is locked by someone else
 * Auto-unlocks if inactive for more than 2 hours
 */
const checkCaseLock = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const userEmail = req.body.performedBy || req.body.createdBy || req.body.clonedBy;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required for case operations',
      });
    }
    
    // Find case by caseId (not MongoDB _id)
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: 'Case not found',
      });
    }
    
    // Check if case is locked by another user
    if (caseData.lockStatus.isLocked && 
        caseData.lockStatus.activeUserEmail && 
        caseData.lockStatus.activeUserEmail !== userEmail.toLowerCase()) {
      
      // Check for inactivity auto-unlock (2 hours = 7200000 ms)
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
      const lastActivity = caseData.lockStatus.lastActivityAt || caseData.lockStatus.lockedAt;
      const now = new Date();
      
      if (lastActivity && (now - lastActivity) > TWO_HOURS_MS) {
        // Auto-unlock due to inactivity
        console.log(`Auto-unlocking case ${caseId} due to 2-hour inactivity`);
        
        const CaseHistory = require('../models/CaseHistory.model');
        
        // Log the auto-unlock in history
        await CaseHistory.create({
          caseId,
          actionType: 'AutoUnlocked',
          description: `Case auto-unlocked due to 2 hours of inactivity. Previous lock holder: ${caseData.lockStatus.activeUserEmail}`,
          performedBy: 'system',
        });
        
        // Unlock the case
        caseData.lockStatus = {
          isLocked: false,
          activeUserEmail: null,
          lockedAt: null,
          lastActivityAt: null,
        };
        await caseData.save();
        
        // Continue with the request
      } else {
        // Still within 2-hour window, deny access
        return res.status(409).json({
          success: false,
          message: `Case is currently locked by ${caseData.lockStatus.activeUserEmail}. Please try again later.`,
          lockedBy: caseData.lockStatus.activeUserEmail,
          lockedAt: caseData.lockStatus.lockedAt,
          lastActivityAt: lastActivity,
        });
      }
    }
    
    // Store case data for use in controller
    req.caseData = caseData;
    req.userEmail = userEmail.toLowerCase();
    
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking case lock status',
      error: error.message,
    });
  }
};

/**
 * Lock a case for the current user
 */
const lockCase = async (caseId, userEmail) => {
  try {
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      throw new Error('Case not found');
    }
    
    caseData.lockStatus = {
      isLocked: true,
      activeUserEmail: userEmail.toLowerCase(),
      lockedAt: new Date(),
    };
    
    await caseData.save();
    return caseData;
  } catch (error) {
    throw error;
  }
};

/**
 * Unlock a case
 */
const unlockCase = async (caseId) => {
  try {
    const caseData = await Case.findOne({ caseId });
    
    if (!caseData) {
      throw new Error('Case not found');
    }
    
    caseData.lockStatus = {
      isLocked: false,
      activeUserEmail: null,
      lockedAt: null,
    };
    
    await caseData.save();
    return caseData;
  } catch (error) {
    throw error;
  }
};

module.exports = {
  checkCaseLock,
  lockCase,
  unlockCase,
};
