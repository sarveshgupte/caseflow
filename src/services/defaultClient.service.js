const Client = require('../models/Client.model');
const { generateNextClientId } = require('./clientIdGenerator');

/**
 * Ensure a firm has an internal default client.
 * Creates the client and links defaultClientId if missing.
 *
 * @param {object} firm - Firm mongoose document
 * @param {object} session - Optional mongoose session
 * @returns {Promise<object|null>} Created client document if created, otherwise null
 */
const ensureDefaultClientForFirm = async (firm, session = null) => {
  if (!firm) {
    throw new Error('Firm is required to ensure default client');
  }

  // If default client already exists, nothing to do
  if (firm.defaultClientId) {
    return null;
  }

  const clientId = await generateNextClientId(firm._id, session);

  const internalClient = new Client({
    clientId,
    businessName: firm.name,
    businessAddress: 'Default Address',
    primaryContactNumber: '0000000000',
    businessEmail: `${(firm.firmId || firm._id).toString().toLowerCase()}@system.local`,
    firmId: firm._id,
    isSystemClient: true,
    isInternal: true,
    createdBySystem: true,
    status: 'ACTIVE',
    isActive: true,
    createdByXid: 'SUPERADMIN',
    createdBy: process.env.SUPERADMIN_EMAIL || 'superadmin@system.local',
  });

  await internalClient.save(session ? { session } : undefined);
  firm.defaultClientId = internalClient._id;
  await firm.save(session ? { session } : undefined);

  console.log(`[FIRM_CREATE] Internal client created for firm ${firm._id}`);
  console.log(`[FIRM_CREATE] defaultClientId linked: ${internalClient._id}`);

  return internalClient;
};

module.exports = {
  ensureDefaultClientForFirm,
};
