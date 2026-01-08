const Case = require('../models/Case.model');

/**
 * Case ID Generator Service
 * 
 * Generates unique, deterministic case IDs in format: CASE-YYYYMMDD-XXXXX
 * Example: CASE-20260108-00012
 * 
 * Rules:
 * - Daily sequence, zero-padded to 5 digits
 * - Sequence resets daily
 * - Generated using server time
 * - Unique DB index enforced
 * - Never editable
 */

/**
 * Generate case ID for current date
 * Format: CASE-YYYYMMDD-XXXXX
 * 
 * @returns {Promise<string>} Generated case ID
 */
async function generateCaseId() {
  try {
    // Get current date components
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Create date prefix: YYYYMMDD
    const datePrefix = `${year}${month}${day}`;
    const casePrefix = `CASE-${datePrefix}-`;
    
    // Find the highest case number for today
    // Use regex to match cases from today: CASE-20260108-XXXXX
    const todayCases = await Case.find({
      caseId: new RegExp(`^${casePrefix.replace(/[-]/g, '\\-')}\\d{5}$`)
    })
    .select('caseId')
    .sort({ caseId: -1 })
    .limit(1)
    .lean();
    
    let nextNumber = 1;
    
    if (todayCases.length > 0 && todayCases[0].caseId) {
      // Extract the sequence number (last 5 digits)
      const match = todayCases[0].caseId.match(/(\d{5})$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    // Format as 5-digit zero-padded number
    const sequenceNumber = String(nextNumber).padStart(5, '0');
    
    // Generate final case ID
    const caseId = `${casePrefix}${sequenceNumber}`;
    
    return caseId;
  } catch (error) {
    throw new Error(`Error generating case ID: ${error.message}`);
  }
}

/**
 * Validate case ID format
 * 
 * @param {string} caseId - Case ID to validate
 * @returns {boolean} True if valid format
 */
function isValidCaseIdFormat(caseId) {
  // Format: CASE-YYYYMMDD-XXXXX (e.g., CASE-20260108-00012)
  const pattern = /^CASE-\d{8}-\d{5}$/;
  return pattern.test(caseId);
}

/**
 * Extract date from case ID
 * 
 * @param {string} caseId - Case ID
 * @returns {Date|null} Extracted date or null if invalid
 */
function extractDateFromCaseId(caseId) {
  if (!isValidCaseIdFormat(caseId)) {
    return null;
  }
  
  // Extract YYYYMMDD from case ID (after "CASE-")
  const dateStr = caseId.substring(5, 13);
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1; // JS months are 0-indexed
  const day = parseInt(dateStr.substring(6, 8), 10);
  
  return new Date(year, month, day);
}

module.exports = {
  generateCaseId,
  isValidCaseIdFormat,
  extractDateFromCaseId,
};
