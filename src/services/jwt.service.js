const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * JWT Service for Docketra Case Management System
 * 
 * Handles JWT token generation, validation, and refresh token management
 * Implements secure token rotation and multi-tenancy support
 */

// Token expiry durations
const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY_DAYS = 7; // 7 days
const DEFAULT_REFRESH_UNIT = 'd'; // days
// Supported refresh token expiry units (case-insensitive): seconds (s), minutes (m), hours (h), days (d)
const TIME_UNIT_REGEX = /^(\d+)\s*([smhd])?$/i;
const TIME_UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const parseRefreshExpiryMs = () => {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN;
  if (!raw) {
    return REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  }

  const trimmed = raw.trim();
  const match = TIME_UNIT_REGEX.exec(trimmed);
  if (!match) {
    return REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  }

  const value = parseInt(match[1], 10);
  const unitKey = (match[2] || DEFAULT_REFRESH_UNIT).toLowerCase();
  const unitMs = TIME_UNIT_MS[unitKey];

  if (!Number.isFinite(value) || value <= 0 || !unitMs) {
    return REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  }

  return value * unitMs;
};

/**
 * Generate access token (JWT)
 * @param {Object} payload - Token payload
 * @param {string} payload.userId - MongoDB _id of user
 * @param {string} [payload.firmId] - Firm/Organization ID (null for SUPER_ADMIN)
 * @param {string} [payload.firmSlug] - Firm slug for routing (null for SUPER_ADMIN)
 * @param {string} [payload.defaultClientId] - Default client ID (null for SUPER_ADMIN)
 * @param {string} payload.role - User role (SUPER_ADMIN/Admin/Employee)
 * @returns {string} JWT access token
 */
const generateAccessToken = (payload) => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  
  // Create JWT with standard claims
  // Note: firmId, firmSlug, defaultClientId are optional for SUPER_ADMIN role
  const tokenPayload = {
    userId: payload.userId,
    role: payload.role,
    type: 'access',
  };

  // OBJECTIVE 2: Include firm context in token (firmId, firmSlug, defaultClientId)
  // Only include firm context if provided (including explicit null for SuperAdmin)
  if ('firmId' in payload) {
    tokenPayload.firmId = payload.firmId;
  }

  if (payload.firmSlug) {
    tokenPayload.firmSlug = payload.firmSlug;
  }

  if (payload.defaultClientId) {
    tokenPayload.defaultClientId = payload.defaultClientId;
  }

  if (payload.isSuperAdmin !== undefined) {
    tokenPayload.isSuperAdmin = payload.isSuperAdmin;
  }
  
  return jwt.sign(
    tokenPayload,
    secret,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: 'docketra',
      audience: 'docketra-api',
      algorithm: 'HS256', // Explicitly specify algorithm
    }
  );
};

/**
 * Generate refresh token
 * @returns {string} Cryptographically secure random token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Hash refresh token for storage
 * @param {string} token - Plain text refresh token
 * @returns {string} SHA256 hash of token
 */
const hashRefreshToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

/**
 * Calculate refresh token expiry date
 * @returns {Date} Expiry timestamp
 */
const getRefreshTokenExpiry = () => {
  const expiryMs = parseRefreshExpiryMs();
  return new Date(Date.now() + expiryMs);
};

const getRefreshTokenExpiryMs = () => parseRefreshExpiryMs();

/**
 * Verify and decode access token
 * @param {string} token - JWT access token
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyAccessToken = (token) => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'docketra',
      audience: 'docketra-api',
    });
    
    // Verify token type
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if not found
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }
  
  // Check for Bearer token format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiry,
  getRefreshTokenExpiryMs,
  verifyAccessToken,
  extractTokenFromHeader,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
};
