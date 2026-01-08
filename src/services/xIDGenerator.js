/**
 * xID Generator Service
 * 
 * Generates unique, sequential xIDs for user accounts
 * Format: X000001, X000002, X000003, etc.
 * 
 * This service ensures:
 * - Server-side generation only (never client-provided)
 * - Sequential numbering for easy reference
 * - Uniqueness guarantees (via atomic MongoDB operations)
 * - Immutability (xID cannot be changed after creation)
 * - Race-condition safety under concurrent requests
 */

const Counter = require('../models/Counter.model');
const User = require('../models/User.model');

/**
 * Generate the next available xID atomically
 * Uses MongoDB's findOneAndUpdate with $inc for atomic counter increment
 * This prevents race conditions under concurrent user creation
 * 
 * @returns {Promise<string>} Next xID in format X000001
 */
const generateNextXID = async () => {
  try {
    // Atomically increment the xID counter
    // - upsert: true creates the counter if it doesn't exist (starts at 0, then increments to 1)
    // - new: true returns the updated document (after increment)
    // - $inc: 1 atomically increments the value by 1
    const counter = await Counter.findOneAndUpdate(
      { name: 'xID' },
      { $inc: { value: 1 } },
      { upsert: true, new: true }
    );
    
    // Format the counter value with leading zeros (6 digits)
    const paddedNumber = String(counter.value).padStart(6, '0');
    const xID = `X${paddedNumber}`;
    
    console.log(`[xID Generator] Generated xID: ${xID}`);
    
    return xID;
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
