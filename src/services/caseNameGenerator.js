const Case = require('../models/Case.model');

/**
 * Case Name Generator Service
 * PART E - Deterministic Case Naming
 * 
 * Generates unique, deterministic case names in format: caseYYYYMMDDxxxxx
 * Example: case2026010700001
 * 
 * Rules:
 * - Sequence resets daily
 * - Generated using server time
 * - Zero-padded to 5 digits (xxxxx)
 * - Primary external identifier for cases
 */

/**
 * Generate case name for current date
 * Format: caseYYYYMMDDxxxxx
 * 
 * @returns {Promise<string>} Generated case name
 */
async function generateCaseName() {
  try {
    // Get current date components
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Create date prefix: YYYYMMDD
    const datePrefix = `${year}${month}${day}`;
    const casePrefix = `case${datePrefix}`;
    
    // Find the highest case number for today
    // Use regex to match cases from today: case20260107xxxxx
    const todayCases = await Case.find({
      caseName: new RegExp(`^${casePrefix}\\d{5}$`)
    })
    .select('caseName')
    .sort({ caseName: -1 })
    .limit(1)
    .lean();
    
    let nextNumber = 1;
    
    if (todayCases.length > 0 && todayCases[0].caseName) {
      // Extract the sequence number (last 5 digits)
      const match = todayCases[0].caseName.match(/(\d{5})$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    // Format as 5-digit zero-padded number
    const sequenceNumber = String(nextNumber).padStart(5, '0');
    
    // Generate final case name
    const caseName = `${casePrefix}${sequenceNumber}`;
    
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
