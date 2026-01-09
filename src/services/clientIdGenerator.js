/**
 * Client ID Generator Service
 * 
 * Generates unique, sequential clientIds for client records
 * Format: C000001, C000002, C000003, etc.
 * 
 * This service ensures:
 * - Server-side generation only (never client-provided)
 * - Sequential numbering for easy reference
 * - Uniqueness guarantees (via atomic MongoDB operations)
 * - Immutability (clientId cannot be changed after creation)
 * - Race-condition safety under concurrent requests
 */

const Counter = require('../models/Counter.model');
const Client = require('../models/Client.model');

/**
 * Generate the next available clientId atomically
 * Uses MongoDB's findOneAndUpdate with $inc for atomic counter increment
 * This prevents race conditions under concurrent client creation
 * 
 * @returns {Promise<string>} Next clientId in format C000001
 */
const generateNextClientId = async () => {
  try {
    // Atomically increment the clientId counter
    // - upsert: true creates the counter if it doesn't exist (starts at 0, then increments to 1)
    // - new: true returns the updated document (after increment)
    // - $inc: 1 atomically increments the value by 1
    const counter = await Counter.findOneAndUpdate(
      { name: 'clientId' },
      { $inc: { value: 1 } },
      { upsert: true, new: true }
    );
    
    // Format the counter value with leading zeros (6 digits)
    const paddedNumber = String(counter.value).padStart(6, '0');
    const clientId = `C${paddedNumber}`;
    
    return clientId;
  } catch (error) {
    console.error('[Client ID Generator] Error generating clientId:', error);
    throw new Error('Failed to generate clientId');
  }
};

/**
 * Validate clientId format
 * @param {string} clientId - clientId to validate
 * @returns {boolean} True if valid format
 */
const validateClientIdFormat = (clientId) => {
  if (!clientId || typeof clientId !== 'string') {
    return false;
  }
  
  // Must match format: C followed by 6 digits
  return /^C\d{6}$/.test(clientId);
};

/**
 * Check if clientId already exists
 * @param {string} clientId - clientId to check
 * @returns {Promise<boolean>} True if clientId exists
 */
const clientIdExists = async (clientId) => {
  try {
    const client = await Client.findOne({ clientId }).lean();
    return !!client;
  } catch (error) {
    console.error('[Client ID Generator] Error checking clientId existence:', error);
    throw new Error('Failed to check clientId existence');
  }
};

module.exports = {
  generateNextClientId,
  validateClientIdFormat,
  clientIdExists,
};
