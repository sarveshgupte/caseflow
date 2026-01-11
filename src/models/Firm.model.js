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
   * Bootstrap status for firm onboarding lifecycle
   * 
   * PR-2: Bootstrap Atomicity & Identity Decoupling
   * Tracks the completion state of firm initialization
   * 
   * PENDING - Firm is being created, not ready for use
   * COMPLETED - Firm fully initialized (has default client and admin)
   * FAILED - Firm creation failed, requires manual intervention
   * 
   * Admin login is blocked until bootstrapStatus = COMPLETED
   * This prevents ghost firms and ensures data integrity
   */
  bootstrapStatus: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
    index: true,
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

/**
 * PRE-SAVE HOOK: Enforce firm hierarchy guardrails
 * 
 * Prevents saving firms in COMPLETED status without defaultClientId
 * This guardrail ensures data integrity and prevents incomplete firm hierarchies
 */
// IMPORTANT: Async Mongoose middleware must NOT use `next`
firmSchema.pre('save', async function() {
  // GUARDRAIL: Firm with COMPLETED bootstrap must have defaultClientId
  if (this.bootstrapStatus === 'COMPLETED' && !this.defaultClientId) {
    const error = new Error(
      'Cannot mark firm as COMPLETED without defaultClientId. ' +
      'Firm hierarchy requires: Firm → Default Client → Admins'
    );
    error.name = 'ValidationError';
    throw error;
  }
});

module.exports = mongoose.model('Firm', firmSchema);
