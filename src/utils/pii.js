/**
 * PII Masking Utility
 * Centralized helpers to mask sensitive values before logging.
 *
 * Covered fields:
 * - Passwords (all variations) -> ***REDACTED***
 * - PAN (e.g., ABCDE1234F) -> AB***1234F
 * - Aadhaar (12 digits) -> **** **** 1234
 * - Email -> j***@d***.com
 * - Phone -> ********7890
 * - Tokens/Authorization headers -> prefix + last 2 characters preserved
 */

const PAN_REGEX = /^([A-Z]{5})(\d{4})([A-Z])$/i;
const AADHAAR_REGEX = /^(\d{8})(\d{4})$/;
const JWT_REGEX = /[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/;
const MASK_SEGMENT_LENGTH = 4;
const MIN_JWT_LENGTH = 20;
const MIN_TOKEN_MASK_LENGTH = 6;

const maskEmail = (value) => {
  if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return value;
  const [local, domain] = value.split('@');
  const prefix = local.slice(0, 2);
  const maskedLocal = local.length > 2 ? `${prefix}***` : '***';
  const domainParts = domain.split('.');
  const tld = domainParts.pop() || '';
  const domainName = domainParts.join('.') || '';
  const maskedDomain =
    domainName && domainName.length > 0
      ? `${domainName.charAt(0)}***${domainName.length > 1 ? domainName.slice(-1) : ''}.${tld}`
      : `${domain.charAt(0)}***.${tld || domain}`;
  return `${maskedLocal}@${maskedDomain}`;
};

const maskPhone = (value) => {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return '*'.repeat(digits.length);
  const visible = digits.slice(-4);
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${visible}`;
};

const maskPAN = (value) => {
  if (typeof value !== 'string') return value;
  const match = value.match(PAN_REGEX);
  if (!match) return value;
  const [, start, middle, end] = match;
  return `${start.slice(0, 2)}***${middle}${end}`;
};

const maskAadhaar = (value) => {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/\s|-/g, '');
  if (!/^\d{12}$/.test(cleaned)) return value;
  const match = cleaned.match(AADHAAR_REGEX);
  if (!match) return value;
  const [, prefix, suffix] = match;
  const maskedPrefix = `${'*'.repeat(MASK_SEGMENT_LENGTH)} ${'*'.repeat(MASK_SEGMENT_LENGTH)}`;
  return `${maskedPrefix} ${suffix}`;
};

const maskToken = (value) => {
  if (typeof value !== 'string') return value;
  if (value.length <= MIN_TOKEN_MASK_LENGTH) return '*'.repeat(value.length);
  return `${value.slice(0, MASK_SEGMENT_LENGTH)}***${value.slice(-2)}`;
};

const maskValue = (key, value, seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'object') return maskSensitiveObject(value, seen);

  const lowerKey = (key || '').toLowerCase();

  if (['email', 'useremail'].includes(lowerKey)) return maskEmail(value);
  if (['phone', 'phonenumber', 'mobile'].includes(lowerKey)) return maskPhone(value);
  if (['pan', 'pan_number', 'pannumber'].includes(lowerKey)) return maskPAN(value);
  if (['aadhaar', 'aadhar', 'aadhaarnumber'].includes(lowerKey)) return maskAadhaar(value);
  if (['authorization', 'token', 'refreshtoken', 'accesstoken', 'idtoken'].includes(lowerKey)) return maskToken(value);
  
  // CRITICAL SECURITY: Mask password fields (all variations)
  // Passwords must NEVER appear in logs under any circumstance
  if (['password', 'currentpassword', 'newpassword', 'oldpassword', 'passwordhash'].includes(lowerKey)) {
    return '***REDACTED***';
  }

  // Heuristic masking for strings that look like tokens
  if (typeof value === 'string' && value.length > MIN_JWT_LENGTH && JWT_REGEX.test(value)) {
    // Likely JWT
    return maskToken(value);
  }

  return value;
};

const maskSensitiveObject = (input, seen = new WeakSet()) => {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    if (seen.has(input)) return '[Circular]';
    seen.add(input);
    return input.map((item) => maskSensitiveObject(item, seen));
  }
  if (typeof input !== 'object') return input;
  if (seen.has(input)) return '[Circular]';
  seen.add(input);

  return Object.entries(input).reduce((acc, [key, value]) => {
    acc[key] = maskValue(key, value, seen);
    return acc;
  }, {});
};

const sanitizeErrorForLog = (error) => {
  if (!error) return error;
  const base = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
  const serialized = Object.getOwnPropertyNames(error).reduce((acc, key) => {
    acc[key] = error[key];
    return acc;
  }, base);
  const seen = new WeakSet();
  return maskSensitiveObject({
    ...serialized,
  }, seen);
};

module.exports = {
  maskEmail,
  maskPhone,
  maskPAN,
  maskAadhaar,
  maskToken,
  maskSensitiveObject,
  maskValue,
  sanitizeErrorForLog,
};
