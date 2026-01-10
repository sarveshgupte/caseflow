const mongoose = require('mongoose');

/**
 * Firm Model for Multi-Tenancy
 * 
 * Represents an organization/firm in the system.
 * Each user belongs to exactly one firm (immutable).
 * Firms provide tenant isolation across the system.
 * 
 * Key Features:
 * - Immutable firmId and name
 * - Read-only visibility for users
 * - Admin-controlled only
 */

const firmSchema = new mongoose.Schema({
  /**
   * Firm identifier
   * Format: FIRM001, FIRM002, etc.
   * IMMUTABLE - Cannot be changed after creation
   */
  firmId: {
    type: String,
    required: [true, 'Firm ID is required'],
    unique: true,
    uppercase: true,
    trim: true,
    immutable: true,
    match: [/^FIRM\d{3,}$/, 'firmId must be in format FIRM001'],
  },
  
  /**
   * Firm/Organization name
   * IMMUTABLE - Cannot be changed after creation
   */
  name: {
    type: String,
    required: [true, 'Firm name is required'],
    trim: true,
    immutable: true,
  },
  
  /**
   * Firm slug - URL-safe identifier for firm-scoped login
   * Format: lowercase-with-hyphens (e.g., "teekeet-store")
   * IMMUTABLE - Cannot be changed after creation
   * GLOBALLY UNIQUE - No two firms can have the same slug
   * Used in firm login URL: /f/:firmSlug/login
   */
  firmSlug: {
    type: String,
    required: [true, 'Firm slug is required'],
    unique: true,
    lowercase: true,
    trim: true,
    immutable: true,
    match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'firmSlug must be URL-safe (lowercase letters, numbers, and hyphens only)'],
  },
  
  /**
   * Default Client ID - represents the firm itself
   * Every firm MUST have exactly one default client
   * This client is created automatically when the firm is created
   * REQUIRED - A firm cannot exist without its default client
   */
  defaultClientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: function() {
      // Allow initial creation inside a transaction, enforce thereafter
      return !this.isNew;
    },
    index: true,
  },
  
  /**
   * Firm status for lifecycle management
   * ACTIVE - Firm is operational
   * SUSPENDED - Firm is temporarily blocked from login (Superadmin action)
   * INACTIVE - Firm is disabled (soft delete)
   */
  status: {
    type: String,
    enum: ['ACTIVE', 'SUSPENDED', 'INACTIVE'],
    default: 'ACTIVE',
  },
  
  /**
   * Audit trail for firm creation
   */
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes for performance
// Note: firmId and firmSlug already have unique indexes from schema definition
firmSchema.index({ status: 1 });
firmSchema.index({ firmSlug: 1 }); // For fast firm resolution during login

module.exports = mongoose.model('Firm', firmSchema);
