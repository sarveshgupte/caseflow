/**
 * xID Generator Service
 * 
 * Generates unique, sequential xIDs for user accounts
 * Format: X000001, X000002, X000003, etc.
 * 
 * This service ensures:
 * - Server-side generation only (never client-provided)
 * - Sequential numbering for easy reference
 * - Uniqueness guarantees
 * - Immutability (xID cannot be changed after creation)
 */

const User = require('../models/User.model');

/**
 * Generate the next available xID
 * @returns {Promise<string>} Next xID in format X000001
 */
const generateNextXID = async () => {
  try {
    // Find all users and get their xIDs
    const users = await User.find()
      .select('xID')
      .lean();
    
    if (!users || users.length === 0) {
      // First user - start with X000001
      return 'X000001';
    }
    
    // Extract numeric parts and find the highest
    let maxNumber = 0;
    for (const user of users) {
      if (user.xID && /^X\d{6}$/.test(user.xID)) {
        const number = parseInt(user.xID.substring(1), 10);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    }
    
    // Increment and pad with zeros
    const nextNumber = maxNumber + 1;
    const paddedNumber = String(nextNumber).padStart(6, '0');
    
    return `X${paddedNumber}`;
  } catch (error) {
    console.error('[xID Generator] Error generating xID:', error);
    throw new Error('Failed to generate xID');
  }
};

/**
 * Validate xID format
 * @param {string} xID - xID to validate
 * @returns {boolean} True if valid format
 */
const validateXIDFormat = (xID) => {
  if (!xID || typeof xID !== 'string') {
    return false;
  }
  
  // Must match format: X followed by 6 digits
  return /^X\d{6}$/.test(xID);
};

/**
 * Check if xID already exists
 * @param {string} xID - xID to check
 * @returns {Promise<boolean>} True if xID exists
 */
const xIDExists = async (xID) => {
  try {
    const user = await User.findOne({ xID: xID.toUpperCase() }).lean();
    return !!user;
  } catch (error) {
    console.error('[xID Generator] Error checking xID existence:', error);
    throw new Error('Failed to check xID existence');
  }
};

module.exports = {
  generateNextXID,
  validateXIDFormat,
  xIDExists,
};
