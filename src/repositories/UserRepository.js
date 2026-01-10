const User = require('../models/User.model');

/**
 * ⚠️ SECURITY: User Repository - Firm-Scoped Data Access Layer ⚠️
 * 
 * This repository enforces firm isolation by design.
 * ALL user queries MUST include firmId to prevent cross-tenant data access.
 * 
 * MANDATORY RULES:
 * 1. firmId MUST be the first parameter of every method (except for auth flows)
 * 2. firmId MUST come from req.user.firmId, NEVER from request params/body
 * 3. Controllers MUST NOT query User model directly
 * 4. All queries MUST include { firmId, ... } filter
 * 
 * EXCEPTIONS:
 * - Authentication flows may use findById or findByEmail without firmId
 * - These are handled separately with proper validation
 * 
 * This prevents IDOR (Insecure Direct Object Reference) attacks where:
 * - A user from Firm A guesses/enumerates userId/xID from Firm B
 * - Attempts to view, update, or access that user
 * 
 * Expected result: System behaves as if the user does not exist.
 */

const UserRepository = {
  /**
   * Find user by xID with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} xID - User identifier (X000001, etc.)
   * @returns {Promise<Object|null>} User document or null
   */
  findByXID(firmId, xID) {
    if (!firmId || !xID) {
      return null;
    }
    return User.findOne({ firmId, xID });
  },

  /**
   * Find user by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @returns {Promise<Object|null>} User document or null
   */
  findById(firmId, _id) {
    if (!firmId || !_id) {
      return null;
    }
    return User.findOne({ firmId, _id });
  },

  /**
   * Find user by email with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} email - User email address
   * @returns {Promise<Object|null>} User document or null
   */
  findByEmail(firmId, email) {
    if (!firmId || !email) {
      return null;
    }
    return User.findOne({ firmId, email: email.toLowerCase() });
  },

  /**
   * Find users with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<Array>} Array of user documents
   */
  find(firmId, query = {}) {
    if (!firmId) {
      return Promise.resolve([]);
    }
    return User.find({ firmId, ...query });
  },

  /**
   * Find one user with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<Object|null>} User document or null
   */
  findOne(firmId, query = {}) {
    if (!firmId) {
      return null;
    }
    return User.findOne({ firmId, ...query });
  },

  /**
   * Update user by xID with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} xID - User identifier
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated user document or null
   */
  updateByXID(firmId, xID, update) {
    if (!firmId || !xID) {
      return null;
    }
    return User.updateOne({ firmId, xID }, update);
  },

  /**
   * Update user by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated user document or null
   */
  updateById(firmId, _id, update) {
    if (!firmId || !_id) {
      return null;
    }
    return User.updateOne({ firmId, _id }, update);
  },

  /**
   * Count users with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<number>} Count of users
   */
  count(firmId, query = {}) {
    if (!firmId) {
      return Promise.resolve(0);
    }
    return User.countDocuments({ firmId, ...query });
  },

  /**
   * Create a new user
   * NOTE: firmId MUST be included in userData
   * @param {Object} userData - User data including firmId
   * @returns {Promise<Object>} Created user document
   */
  create(userData) {
    if (!userData.firmId && userData.role !== 'SUPER_ADMIN') {
      throw new Error('firmId is required to create a user (except for SUPER_ADMIN)');
    }
    return User.create(userData);
  },

  // ============================================================
  // AUTHENTICATION-ONLY METHODS (NO FIRM SCOPING)
  // These are used during authentication flows where firmId
  // is not yet available or validated
  // ============================================================

  /**
   * Find user by MongoDB _id WITHOUT firm scoping
   * ⚠️ USE ONLY FOR AUTHENTICATION FLOWS
   * @param {string|ObjectId} _id - MongoDB document ID
   * @returns {Promise<Object|null>} User document or null
   */
  findByIdUnsafe(_id) {
    return User.findById(_id);
  },

  /**
   * Find user by email WITHOUT firm scoping
   * ⚠️ USE ONLY FOR AUTHENTICATION FLOWS
   * @param {string} email - User email address
   * @returns {Promise<Object|null>} User document or null
   */
  findByEmailUnsafe(email) {
    return User.findOne({ email: email.toLowerCase() });
  },
};

module.exports = UserRepository;
