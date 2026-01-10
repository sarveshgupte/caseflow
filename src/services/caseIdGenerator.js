const { getNextSequence } = require('./counter.service');

/**
 * Case ID Generator Service
 * 
 * Generates unique, deterministic case IDs in format: CASE-YYYYMMDD-XXXXX
 * Example: CASE-20260108-00012
 * 
 * PR 2: Atomic Counter Implementation
 * - Uses MongoDB atomic counters to eliminate race conditions
 * - Firm-scoped for multi-tenancy
 * - Daily sequences via date-specific counter names
 * 
 * Rules:
 * - Daily sequences, zero-padded to 5 digits
 * - New counter per day (not reset, but new counter name)
 * - Generated using server time
 * - Unique DB index enforced
 * - Never editable
 * - Concurrency-safe through atomic operations
 */

/**
 * Generate case ID for current date
 * Format: CASE-YYYYMMDD-XXXXX
 * 
 * @param {string} firmId - Firm ID for tenant scoping (REQUIRED)
 * @returns {Promise<string>} Generated case ID
 * @throws {Error} If firmId is missing or generation fails
 */
async function generateCaseId(firmId) {
  try {
    // Validate firmId
    if (!firmId) {
      throw new Error('Firm ID is required for case ID generation');
    }
    
    // Get current date components
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Create date prefix: YYYYMMDD
    const datePrefix = `${year}${month}${day}`;
    const casePrefix = `CASE-${datePrefix}-`;
    
    // Counter name includes date for daily reset
    // Format: case-YYYYMMDD (e.g., case-20260108)
    const counterName = `case-${datePrefix}`;
    
    // Get next sequence atomically - this is thread-safe and eliminates race conditions
    const sequenceNumber = await getNextSequence(counterName, firmId);
    
    // Format as 5-digit zero-padded number
    const paddedSequence = String(sequenceNumber).padStart(5, '0');
    
    // Generate final case ID
    const caseId = `${casePrefix}${paddedSequence}`;
    
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
