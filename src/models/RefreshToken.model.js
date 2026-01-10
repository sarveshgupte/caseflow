const mongoose = require('mongoose');

/**
 * RefreshToken Model for Docketra Case Management System
 * 
 * Stores refresh tokens for JWT-based authentication
 * Tokens are rotated on every use for security
 * Tokens are invalidated on logout and password change
 * 
 * Security Features:
 * - Token rotation on refresh
 * - Automatic expiry
 * - User agent and IP tracking
 * - Firm-level isolation
 */

const refreshTokenSchema = new mongoose.Schema({
  // Token hash (never store plain text)
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  
  // User ID (MongoDB ObjectId)
  // For SuperAdmin, this can be null (SuperAdmin not in DB)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Allow null for SuperAdmin
    index: true,
  },
  
  // Firm/Organization ID for multi-tenancy
  // For SuperAdmin, this can be null (platform-level access)
  firmId: {
    type: String,
    required: false, // Allow null for SuperAdmin
    index: true,
  },
  
  // Token expiry timestamp
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  
  // IP address where token was issued
  ipAddress: {
    type: String,
  },
  
  // User agent string
  userAgent: {
    type: String,
  },
  
  // Whether token has been revoked
  isRevoked: {
    type: Boolean,
    default: false,
    index: true,
  },
  
  // When token was created
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  
  // Track when token was last used (for rotation)
  lastUsedAt: {
    type: Date,
  },
}, {
  timestamps: false,
});

// Compound index for efficient queries
refreshTokenSchema.index({ userId: 1, isRevoked: 1, expiresAt: 1 });
refreshTokenSchema.index({ firmId: 1, userId: 1 });

// TTL index to auto-delete expired tokens (cleanup after 30 days)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
