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

/**
 * Generate access token (JWT)
 * @param {Object} payload - Token payload
 * @param {string} payload.userId - MongoDB _id of user
 * @param {string} [payload.firmId] - Firm/Organization ID (null for SUPER_ADMIN)
 * @param {string} payload.role - User role (SUPER_ADMIN/Admin/Employee)
 * @returns {string} JWT access token
 */
const generateAccessToken = (payload) => {
  const secret = process.env.JWT_SECRET;
  
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  
  // Create JWT with standard claims
  // Note: firmId is optional for SUPER_ADMIN role
  const tokenPayload = {
    userId: payload.userId,
    role: payload.role,
    type: 'access',
  };
  
  // Only include firmId if it's provided (not null/undefined)
  if (payload.firmId) {
    tokenPayload.firmId = payload.firmId;
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
  const expiryMs = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + expiryMs);
};

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
  verifyAccessToken,
  extractTokenFromHeader,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY_DAYS,
};
