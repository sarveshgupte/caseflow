const mongoose = require('mongoose');
const crypto = require('crypto');
const Firm = require('../models/Firm.model');
const Client = require('../models/Client.model');
const User = require('../models/User.model');
const emailService = require('./email.service');
const { generateNextClientId } = require('./clientIdGenerator');
const { generateNextXID } = require('./xIDGenerator');
const { slugify } = require('../utils/slugify');
const { isFirmCreationDisabled } = require('./featureFlags.service');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SYSTEM_EMAIL_DOMAIN = 'system.local';
const SETUP_TOKEN_EXPIRY_HOURS = 48;
const DEFAULT_BUSINESS_ADDRESS = 'Default Address';
const DEFAULT_CONTACT_NUMBER = '0000000000';

class FirmBootstrapError extends Error {
  constructor(message, statusCode = 500, meta = {}) {
    super(message);
    this.name = 'FirmBootstrapError';
    this.statusCode = statusCode;
    this.meta = meta;
  }
}

const defaultDeps = {
  Firm,
  Client,
  User,
  emailService,
  generateNextClientId,
  generateNextXID,
  startSession: () => mongoose.startSession(),
};

const validatePayload = ({ name, adminName, adminEmail }) => {
  if (!name || !name.trim()) {
    throw new FirmBootstrapError('Firm name is required', 400);
  }
  if (!adminName || !adminName.trim()) {
    throw new FirmBootstrapError('Admin name is required', 400);
  }
  if (!adminEmail || !adminEmail.trim()) {
    throw new FirmBootstrapError('Admin email is required', 400);
  }
  if (!EMAIL_REGEX.test(adminEmail)) {
    throw new FirmBootstrapError('Invalid admin email format', 400);
  }
};

const ensureNotDuplicate = async ({ deps, name, firmSlug, session }) => {
  const existingFirm = await deps.Firm.findOne({
    $or: [{ firmSlug }, { name: name.trim() }],
  }).session(session);
  if (existingFirm) {
    throw new FirmBootstrapError('Firm already exists', 200, { firm: existingFirm, idempotent: true });
  }
};

const buildIds = async (deps, session, name) => {
  const lastFirm = await deps.Firm.findOne({}, {}, { session }).sort({ createdAt: -1 });
  let firmNumber = 1;
  if (lastFirm && lastFirm.firmId) {
    const match = lastFirm.firmId.match(/FIRM(\d+)/);
    if (match) {
      firmNumber = parseInt(match[1], 10) + 1;
    }
  }
  let firmSlug = slugify(name.trim());
  const originalSlug = firmSlug;
  const existingSlugs = await deps.Firm.find({
    firmSlug: { $regex: new RegExp(`^${originalSlug}(?:-\\d+)?$`) },
  }).session(session).select('firmSlug');
  if (existingSlugs.length > 0) {
    const maxSuffix = existingSlugs.reduce((max, doc) => {
      const match = doc.firmSlug.match(/-(\d+)$/);
      const suffixNumber = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, suffixNumber);
    }, 0);
    firmSlug = `${originalSlug}-${maxSuffix + 1}`;
  }
  return { firmId: `FIRM${firmNumber.toString().padStart(3, '0')}`, firmSlug };
};

const createFirmHierarchy = async ({ payload, performedBy, requestId, req = null, deps = defaultDeps }) => {
  if (isFirmCreationDisabled()) {
    throw new FirmBootstrapError('Firm creation is temporarily disabled', 503);
  }

  validatePayload(payload);

  const session = await deps.startSession();
  let createdEntities = null;

  try {
    await session.withTransaction(async () => {
      const { name, adminName, adminEmail } = payload;
      const normalizedName = name.trim();
      const { firmId, firmSlug } = await buildIds(deps, session, normalizedName);
      await ensureNotDuplicate({ deps, name: normalizedName, firmSlug, session });

      const existingUser = await deps.User.findOne({ email: adminEmail.toLowerCase() }).session(session);
      if (existingUser) {
        throw new FirmBootstrapError('User with this email already exists', 409);
      }

      const firm = new deps.Firm({
        firmId,
        name: normalizedName,
        firmSlug,
        status: 'ACTIVE',
        bootstrapStatus: 'PENDING',
      });
      await firm.save({ session });

      const clientId = await deps.generateNextClientId(firm._id, session);
      const defaultClient = new deps.Client({
        clientId,
        businessName: normalizedName,
        businessAddress: DEFAULT_BUSINESS_ADDRESS,
        primaryContactNumber: DEFAULT_CONTACT_NUMBER,
        businessEmail: `${firmId.toLowerCase()}@${SYSTEM_EMAIL_DOMAIN}`,
        firmId: firm._id,
        isSystemClient: true,
        isInternal: true,
        createdBySystem: true,
        isActive: true,
        status: 'ACTIVE',
        createdByXid: 'SUPERADMIN',
        createdBy: process.env.SUPERADMIN_EMAIL || `superadmin@${SYSTEM_EMAIL_DOMAIN}`,
      });
      await defaultClient.save({ session });

      firm.defaultClientId = defaultClient._id;
      await firm.save({ session });

      const adminXID = await deps.generateNextXID(firm._id, session);
      const setupToken = crypto.randomBytes(32).toString('hex');
      const setupTokenHash = crypto.createHash('sha256').update(setupToken).digest('hex');
      const setupExpires = new Date(Date.now() + SETUP_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

      const adminUser = new deps.User({
        xID: adminXID,
        name: adminName.trim(),
        email: adminEmail.toLowerCase(),
        firmId: firm._id,
        defaultClientId: defaultClient._id,
        role: 'Admin',
        status: 'INVITED',
        isActive: true,
        isSystem: true,
        passwordSet: false,
        mustSetPassword: true,
        passwordSetAt: null,
        mustChangePassword: true,
        passwordSetupTokenHash: setupTokenHash,
        passwordSetupExpires: setupExpires,
        inviteSentAt: new Date(),
      });
      await adminUser.save({ session });

      firm.bootstrapStatus = 'COMPLETED';
      await firm.save({ session });

      createdEntities = { firm, defaultClient, adminUser, adminXID, setupToken, firmSlug };
    });

    if (!createdEntities) {
      throw new FirmBootstrapError('Transaction aborted', 500);
    }

    const { firm, defaultClient, adminUser, adminXID, setupToken, firmSlug } = createdEntities;

    try {
      const superadminEmail = process.env.SUPERADMIN_EMAIL;
      if (superadminEmail) {
        await deps.emailService.sendFirmCreatedEmail(superadminEmail, {
          firmId: firm.firmId,
          firmName: firm.name,
          defaultClientId: defaultClient.clientId,
          adminXID,
          adminEmail: adminUser.email,
        }, req);
      }
    } catch (emailError) {
      console.error('[FIRM_BOOTSTRAP] Failed to send firm created email:', emailError.message);
    }

    try {
      console.log(`[FIRM_BOOTSTRAP] Sending password setup email to ${adminUser.email} (xID: ${adminXID})`);
      await deps.emailService.sendPasswordSetupEmail({
        email: adminUser.email,
        name: adminUser.name,
        token: setupToken,
        xID: adminXID,
        firmSlug,
        req,
      });
      console.log('[FIRM_BOOTSTRAP] Password setup email queued successfully');
    } catch (emailError) {
      console.error('[FIRM_BOOTSTRAP] Failed to send admin invite email:', emailError.message);
      // Email issues are logged but don't block firm creation - admin can be invited manually if needed
    }

    return {
      firm,
      defaultClient,
      adminUser,
      requestId,
    };
  } catch (error) {
    if (error instanceof FirmBootstrapError) {
      throw error;
    }
    throw new FirmBootstrapError(error.message || 'Failed to create firm', 500);
  } finally {
    await session.endSession();
  }
};

module.exports = {
  FirmBootstrapError,
  createFirmHierarchy,
  defaultDeps,
};
