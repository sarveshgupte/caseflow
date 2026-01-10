const { getNextSequence } = require('./counter.service');

/**
 * Case Name Generator Service
 * PART E - Deterministic Case Naming
 * 
 * Generates unique, deterministic case names in format: caseYYYYMMDDxxxxx
 * Example: case2026010700001
 * 
 * PR 2: Atomic Counter Implementation
 * - Uses MongoDB atomic counters to eliminate race conditions
 * - Firm-scoped for multi-tenancy
 * - Daily sequences via date-specific counter names
 * 
 * Rules:
 * - New counter per day (not reset, but new counter name)
 * - Generated using server time
 * - Zero-padded to 5 digits (xxxxx)
 * - Primary external identifier for cases
 * - Concurrency-safe through atomic operations
 */

/**
 * Generate case name for current date
 * Format: caseYYYYMMDDxxxxx
 * 
 * @param {string} firmId - Firm ID for tenant scoping (REQUIRED)
 * @returns {Promise<string>} Generated case name
 * @throws {Error} If firmId is missing or generation fails
 */
async function generateCaseName(firmId) {
  try {
    // Validate firmId
    if (!firmId) {
      throw new Error('Firm ID is required for case name generation');
    }
    
    // Get current date components
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Create date prefix: YYYYMMDD
    const datePrefix = `${year}${month}${day}`;
    const casePrefix = `case${datePrefix}`;
    
    // Counter name includes date for daily reset
    // Format: caseName-YYYYMMDD (e.g., caseName-20260110)
    const counterName = `caseName-${datePrefix}`;
    
    // Get next sequence atomically - this is thread-safe and eliminates race conditions
    const sequenceNumber = await getNextSequence(counterName, firmId);
    
    // Format as 5-digit zero-padded number
    const paddedSequence = String(sequenceNumber).padStart(5, '0');
    
    // Generate final case name
    const caseName = `${casePrefix}${paddedSequence}`;
    
    return caseName;
  } catch (error) {
    throw new Error(`Error generating case name: ${error.message}`);
  }
}

/**
 * Validate case name format
 * 
 * @param {string} caseName - Case name to validate
 * @returns {boolean} True if valid format
 */
function isValidCaseNameFormat(caseName) {
  // Format: caseYYYYMMDDxxxxx (e.g., case2026010700001)
  const pattern = /^case\d{8}\d{5}$/;
  return pattern.test(caseName);
}

/**
 * Extract date from case name
 * 
 * @param {string} caseName - Case name
 * @returns {Date|null} Extracted date or null if invalid
 */
function extractDateFromCaseName(caseName) {
  if (!isValidCaseNameFormat(caseName)) {
    return null;
  }
  
  // Extract YYYYMMDD from case name
  const dateStr = caseName.substring(4, 12); // Skip "case" prefix
  const year = parseInt(dateStr.substring(0, 4), 10);
  const month = parseInt(dateStr.substring(4, 6), 10) - 1; // JS months are 0-indexed
  const day = parseInt(dateStr.substring(6, 8), 10);
  
  return new Date(year, month, day);
}

module.exports = {
  generateCaseName,
  isValidCaseNameFormat,
  extractDateFromCaseName,
};
