const Counter = require('../models/Counter.model');

/**
 * Counter Service for Atomic Sequence Generation
 * 
 * Provides thread-safe, atomic counter increments for generating unique IDs
 * Ensures no race conditions, no duplicates, and no skipped numbers
 * 
 * PR 2: Atomic Counter Implementation
 * 
 * Features:
 * - Atomic increments using MongoDB's findOneAndUpdate with $inc
 * - Firm-scoped counters for multi-tenancy
 * - Auto-initialization with upsert
 * - No in-memory state
 * - No time-based logic
 * 
 * Usage:
 *   const nextSeq = await getNextSequence('case', 'FIRM001');
 */

/**
 * Get next sequence number atomically
 * 
 * This is the single source of truth for sequence generation.
 * Uses MongoDB's atomic findOneAndUpdate operation to ensure:
 * - No race conditions
 * - No duplicate sequences
 * - No skipped numbers
 * 
 * @param {string} name - Counter name (e.g., 'case', 'xID')
 * @param {string} firmId - Firm ID for tenant scoping (REQUIRED)
 * @returns {Promise<number>} Next sequence number
 * @throws {Error} If firmId is missing or operation fails
 */
async function getNextSequence(name, firmId) {
  // Validate required parameters
  if (!name || typeof name !== 'string') {
    throw new Error('Counter name is required and must be a string');
  }
  
  if (!firmId || typeof firmId !== 'string') {
    throw new Error('Firm ID is required for tenant-scoped counters');
  }
  
  try {
    // Atomic increment operation
    // $inc: { seq: 1 } - atomically increments the sequence by 1
    // upsert: true - creates counter with seq: 1 if it doesn't exist
    // new: true - returns the document after update (with incremented value)
    const counter = await Counter.findOneAndUpdate(
      { name, firmId },
      { $inc: { seq: 1 } },
      { 
        new: true,        // Return updated document
        upsert: true,     // Create if doesn't exist
      }
    );
    
    if (!counter || typeof counter.seq !== 'number') {
      throw new Error('Counter operation failed - invalid response');
    }
    
    return counter.seq;
  } catch (error) {
    // If this is a duplicate key error during upsert, retry once
    // This can happen in rare concurrent initialization scenarios
    // The counter should exist after the first attempt, so we don't need upsert
    if (error.code === 11000) {
      try {
        // Retry without upsert - counter should exist now
        const counter = await Counter.findOneAndUpdate(
          { name, firmId },
          { $inc: { seq: 1 } },
          { new: true }
        );
        
        if (!counter || typeof counter.seq !== 'number') {
          throw new Error('Counter operation failed after retry - invalid response');
        }
        
        return counter.seq;
      } catch (retryError) {
        // If retry also fails, throw formatted error
        throw new Error(`Error getting next sequence for ${name}/${firmId} after retry: ${retryError.message}`);
      }
    }
    
    // Re-throw other errors with context
    throw new Error(`Error getting next sequence for ${name}/${firmId}: ${error.message}`);
  }
}

/**
 * Get current sequence value without incrementing
 * Useful for debugging and diagnostics
 * 
 * @param {string} name - Counter name
 * @param {string} firmId - Firm ID
 * @returns {Promise<number|null>} Current sequence or null if counter doesn't exist
 */
async function getCurrentSequence(name, firmId) {
  if (!name || !firmId) {
    throw new Error('Counter name and firm ID are required');
  }
  
  const counter = await Counter.findOne({ name, firmId }).lean();
  return counter ? counter.seq : null;
}

/**
 * Initialize counter with a specific starting value
 * WARNING: Only use during system initialization or migration
 * 
 * This function attempts to create a counter with a specific starting value.
 * If the counter already exists, it will fail with an error.
 * 
 * @param {string} name - Counter name
 * @param {string} firmId - Firm ID
 * @param {number} startValue - Starting sequence value
 * @returns {Promise<void>}
 * @throws {Error} If counter already exists or parameters are invalid
 */
async function initializeCounter(name, firmId, startValue) {
  if (!name || !firmId) {
    throw new Error('Counter name and firm ID are required');
  }
  
  if (typeof startValue !== 'number' || startValue < 0) {
    throw new Error('Start value must be a non-negative number');
  }
  
  try {
    // Attempt to create counter atomically
    // This will fail with duplicate key error if counter already exists
    await Counter.create({
      name,
      firmId,
      seq: startValue,
    });
  } catch (error) {
    // If duplicate key error, counter already exists
    if (error.code === 11000) {
      throw new Error(`Counter ${name}/${firmId} already exists. Cannot re-initialize.`);
    }
    // Re-throw other errors
    throw error;
  }
}

module.exports = {
  getNextSequence,
  getCurrentSequence,
  initializeCounter,
};
