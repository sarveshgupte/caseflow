const mongoose = require('mongoose');
const AuthAudit = require('../models/AuthAudit.model');

const buffer = [];

/**
 * Persist an admin/superadmin mutation audit entry.
 * @param {Object} params
 * @param {string} params.actor - xID of the admin performing the action (required for actor trace).
 * @param {string|null} params.firmId - Firm/organization identifier, if applicable.
 * @param {string|mongoose.Types.ObjectId} params.userId - Mongo user id of the actor (optional).
 * @param {string} params.action - Action string (e.g., "POST /api/admin/users").
 * @param {string|null} params.target - Target entity identifier where available.
 * @param {string} params.scope - Scope label (e.g., "admin", "superadmin").
 * @param {string} params.requestId - Request correlation id.
 * @param {number} params.status - HTTP status code returned.
 * @param {number} params.durationMs - Request duration in milliseconds.
 * @param {string} params.ipAddress - Request IP address.
 * @param {string} params.userAgent - Request user agent.
 */
const recordAdminAudit = async ({
  actor,
  firmId,
  userId,
  action,
  target,
  scope,
  requestId,
  status,
  durationMs,
  ipAddress,
  userAgent,
}) => {
  if (!actor) {
    throw new Error('[ADMIN_AUDIT] actor is required to record audit');
  }
  if (!firmId) {
    throw new Error('[ADMIN_AUDIT] firmId is required to record audit');
  }
  const entry = {
    actor,
    firmId,
    userId,
    action,
    target,
    scope,
    requestId,
    status,
    durationMs,
    ipAddress,
    userAgent,
    timestamp: new Date().toISOString(),
  };

  buffer.push(entry);

  if (mongoose.connection?.readyState === 1) {
    try {
      await AuthAudit.create({
        xID: actor || 'UNKNOWN_ACTOR',
        firmId: firmId || 'UNKNOWN_FIRM',
        userId,
        actionType: 'AdminMutation',
        description: action,
        // kept alongside xID for legacy consumers expecting performer field
        performedBy: actor || 'UNKNOWN',
        ipAddress,
        userAgent,
        metadata: {
          target,
          scope,
          requestId,
          status,
          durationMs,
        },
        timestamp: new Date(),
      });
    } catch (err) {
      console.error('[ADMIN_AUDIT] Failed to persist audit log:', err.message);
      process.emitWarning('[ADMIN_AUDIT] Persistence failure', { cause: err });
    }
  }

  return entry;
};

const getBufferedAudits = () => [...buffer];
const resetAuditBuffer = () => buffer.splice(0, buffer.length);

module.exports = {
  recordAdminAudit,
  getBufferedAudits,
  resetAuditBuffer,
};
