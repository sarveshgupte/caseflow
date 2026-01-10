const Case = require('../models/Case.model');

/**
 * ⚠️ SECURITY: Case Repository - Firm-Scoped Data Access Layer ⚠️
 * 
 * This repository enforces firm isolation by design.
 * ALL case queries MUST include firmId to prevent cross-tenant data access.
 * 
 * MANDATORY RULES:
 * 1. firmId MUST be the first parameter of every method
 * 2. firmId MUST come from req.user.firmId, NEVER from request params/body
 * 3. Controllers MUST NOT query Case model directly
 * 4. All queries MUST include { firmId, ... } filter
 * 
 * This prevents IDOR (Insecure Direct Object Reference) attacks where:
 * - A user from Firm A guesses/enumerates caseId from Firm B
 * - Attempts to view, clone, update, or delete that case
 * 
 * Expected result: System behaves as if the case does not exist.
 */

const CaseRepository = {
  /**
   * Find case by caseId with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} caseId - Case identifier
   * @returns {Promise<Object|null>} Case document or null
   */
  findByCaseId(firmId, caseId) {
    if (!firmId || !caseId) {
      return null;
    }
    return Case.findOne({ firmId, caseId });
  },

  /**
   * Find case by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @returns {Promise<Object|null>} Case document or null
   */
  findById(firmId, _id) {
    if (!firmId || !_id) {
      return null;
    }
    return Case.findOne({ firmId, _id });
  },

  /**
   * Find cases with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<Array>} Array of case documents
   */
  find(firmId, query = {}) {
    if (!firmId) {
      return Promise.resolve([]);
    }
    return Case.find({ firmId, ...query });
  },

  /**
   * Find one case with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<Object|null>} Case document or null
   */
  findOne(firmId, query = {}) {
    if (!firmId) {
      return null;
    }
    return Case.findOne({ firmId, ...query });
  },

  /**
   * Update case by caseId with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} caseId - Case identifier
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated case document or null
   */
  updateByCaseId(firmId, caseId, update) {
    if (!firmId || !caseId) {
      return null;
    }
    return Case.updateOne({ firmId, caseId }, update);
  },

  /**
   * Update case by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated case document or null
   */
  updateById(firmId, _id, update) {
    if (!firmId || !_id) {
      return null;
    }
    return Case.updateOne({ firmId, _id }, update);
  },

  /**
   * Delete case by caseId with firm scoping
   * NOTE: Soft deletes are preferred in production systems
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} caseId - Case identifier
   * @returns {Promise<Object>} Delete result
   */
  deleteByCaseId(firmId, caseId) {
    if (!firmId || !caseId) {
      return Promise.resolve({ deletedCount: 0 });
    }
    return Case.deleteOne({ firmId, caseId });
  },

  /**
   * Count cases with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<number>} Count of cases
   */
  count(firmId, query = {}) {
    if (!firmId) {
      return Promise.resolve(0);
    }
    return Case.countDocuments({ firmId, ...query });
  },

  /**
   * Create a new case
   * NOTE: firmId MUST be included in caseData
   * @param {Object} caseData - Case data including firmId
   * @returns {Promise<Object>} Created case document
   */
  create(caseData) {
    if (!caseData.firmId) {
      throw new Error('firmId is required to create a case');
    }
    return Case.create(caseData);
  },
};

module.exports = CaseRepository;
