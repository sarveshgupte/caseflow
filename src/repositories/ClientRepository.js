const Client = require('../models/Client.model');

/**
 * ⚠️ SECURITY: Client Repository - Firm-Scoped Data Access Layer ⚠️
 * 
 * This repository enforces firm isolation by design.
 * ALL client queries MUST include firmId to prevent cross-tenant data access.
 * 
 * MANDATORY RULES:
 * 1. firmId MUST be the first parameter of every method
 * 2. firmId MUST come from req.user.firmId, NEVER from request params/body
 * 3. Controllers MUST NOT query Client model directly
 * 4. All queries MUST include { firmId, ... } filter
 * 
 * This prevents IDOR (Insecure Direct Object Reference) attacks where:
 * - A user from Firm A guesses/enumerates clientId from Firm B
 * - Attempts to view, update, or access that client
 * 
 * Expected result: System behaves as if the client does not exist.
 */

const ClientRepository = {
  /**
   * Find client by clientId with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} clientId - Client identifier (C000001, etc.)
   * @returns {Promise<Object|null>} Client document or null
   */
  findByClientId(firmId, clientId) {
    if (!firmId || !clientId) {
      return null;
    }
    return Client.findOne({ firmId, clientId });
  },

  /**
   * Find client by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @returns {Promise<Object|null>} Client document or null
   */
  findById(firmId, _id) {
    if (!firmId || !_id) {
      return null;
    }
    return Client.findOne({ firmId, _id });
  },

  /**
   * Find clients with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<Array>} Array of client documents
   */
  find(firmId, query = {}) {
    if (!firmId) {
      return Promise.resolve([]);
    }
    return Client.find({ firmId, ...query });
  },

  /**
   * Find one client with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<Object|null>} Client document or null
   */
  findOne(firmId, query = {}) {
    if (!firmId) {
      return null;
    }
    return Client.findOne({ firmId, ...query });
  },

  /**
   * Update client by clientId with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string} clientId - Client identifier
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated client document or null
   */
  updateByClientId(firmId, clientId, update) {
    if (!firmId || !clientId) {
      return null;
    }
    return Client.updateOne({ firmId, clientId }, update);
  },

  /**
   * Update client by MongoDB _id with firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {string|ObjectId} _id - MongoDB document ID
   * @param {Object} update - Update object
   * @returns {Promise<Object|null>} Updated client document or null
   */
  updateById(firmId, _id, update) {
    if (!firmId || !_id) {
      return null;
    }
    return Client.updateOne({ firmId, _id }, update);
  },

  /**
   * Count clients with query and firm scoping
   * @param {string|ObjectId} firmId - Firm ID from req.user.firmId
   * @param {Object} query - Additional query filters
   * @returns {Promise<number>} Count of clients
   */
  count(firmId, query = {}) {
    if (!firmId) {
      return Promise.resolve(0);
    }
    return Client.countDocuments({ firmId, ...query });
  },

  /**
   * Create a new client
   * NOTE: firmId MUST be included in clientData
   * @param {Object} clientData - Client data including firmId
   * @returns {Promise<Object>} Created client document
   */
  create(clientData) {
    if (!clientData.firmId) {
      throw new Error('firmId is required to create a client');
    }
    return Client.create(clientData);
  },
};

module.exports = ClientRepository;
