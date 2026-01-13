const config = require('./config');
const { isGoogleAuthDisabled } = require('../services/featureFlags.service');

const XID_DIGITS = 6;
const SUPERADMIN_XID_REGEX = new RegExp(`^X\\d{${XID_DIGITS}}$`, 'i');
const MIN_JWT_SECRET_LENGTH = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_HASH_REGEX = /^\$2[abxy]?\$\d{2}\$.+/;

const logError = (logFn, details) => {
  (logFn || console.error)({ severity: 'ERROR', scope: 'env', ...details });
};

const validateEnv = ({ exitOnError = true, logger = console } = {}) => {
  const errors = [];

  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    errors.push({ field: 'JWT_SECRET', reason: 'missing or too short' });
  }

  if (!process.env.SUPERADMIN_PASSWORD_HASH || !BCRYPT_HASH_REGEX.test(process.env.SUPERADMIN_PASSWORD_HASH)) {
    errors.push({ field: 'SUPERADMIN_PASSWORD_HASH', reason: 'missing or not bcrypt hash' });
  }

  const superadminXid = process.env.SUPERADMIN_XID;
  if (!superadminXid || !SUPERADMIN_XID_REGEX.test(superadminXid.trim())) {
    errors.push({ field: 'SUPERADMIN_XID', reason: 'missing or invalid format (expected X followed by 6 digits, e.g., X000001)' });
  }

  const superadminEmail = process.env.SUPERADMIN_EMAIL;
  if (!superadminEmail || !EMAIL_REGEX.test(superadminEmail)) {
    errors.push({ field: 'SUPERADMIN_EMAIL', reason: 'missing or invalid format' });
  }

  if (!config.mongodbUri || !config.mongodbUri.startsWith('mongodb')) {
    errors.push({ field: 'MONGODB_URI', reason: 'missing or invalid mongodb connection string' });
  }

  if (!isGoogleAuthDisabled()) {
    if (!process.env.GOOGLE_CLIENT_ID) {
      errors.push({ field: 'GOOGLE_CLIENT_ID', reason: 'missing (required when Google auth enabled)' });
    }
    if (!process.env.GOOGLE_CLIENT_SECRET) {
      errors.push({ field: 'GOOGLE_CLIENT_SECRET', reason: 'missing (required when Google auth enabled)' });
    }
  }

  if (errors.length > 0) {
    logError(logger.error || logger.log, { message: 'Environment validation failed', errors });
    if (exitOnError) {
      process.exit(1);
    }
    return { valid: false, errors };
  }

  return { valid: true };
};

module.exports = {
  validateEnv,
};
