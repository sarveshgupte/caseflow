const mongoose = require('mongoose');

/**
 * SuperadminAudit Model for Docketra Case Management System
 * 
 * APPEND-ONLY - NO UPDATES OR DELETES ALLOWED
 * 
 * This model stores Superadmin action audit logs
 * Enforces immutability to maintain accurate audit trail
 * All Superadmin actions must be logged here
 */

const superadminAuditSchema = new mongoose.Schema({
  // Action type performed by Superadmin
  actionType: {
    type: String,
    required: true,
    enum: [
      'FirmCreated',
      'FirmActivated',
      'FirmSuspended',
      'FirmAdminCreated',
      'SuperadminLogin',
      'SuperadminLogout',
    ],
    index: true,
  },
  
  // Human-readable description of the action
  description: {
    type: String,
    required: true,
  },
  
  // Email of Superadmin who performed this action
  performedBy: {
    type: String,
    required: true,
    index: true,
  },
  
  // MongoDB ObjectId of Superadmin user
  // Optional to support system-triggered actions (e.g., automated firm creation)
  performedById: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  
  // Flag for system-triggered actions (e.g., background jobs, automation)
  // When true, performedById may be null and performedBy should indicate system origin
  performedBySystem: {
    type: Boolean,
    default: false,
  },
  
  // Target entity type (Firm, User, etc.)
  targetEntityType: {
    type: String,
    enum: ['Firm', 'User'],
  },
  
  // Target entity ID (firmId, userId, etc.)
  targetEntityId: {
    type: String,
  },
  
  // IP address of the request (optional)
  ipAddress: String,
  
  // User agent string for device/browser tracking
  userAgent: String,
  
  // When the action was performed
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true,
    index: true,
  },
  
  // Additional metadata (flexible object)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  // Strict mode: Prevents adding arbitrary fields
  strict: true,
  // No automatic timestamps - we manage this manually
  timestamps: false,
});

/**
 * Pre-update Hooks: Prevent Updates
 * 
 * These hooks block any attempt to update existing audit logs.
 * Audit logs must be immutable for compliance.
 */
superadminAuditSchema.pre('updateOne', function(next) {
  next(new Error('Superadmin audit logs cannot be updated'));
});

superadminAuditSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Superadmin audit logs cannot be updated'));
});

superadminAuditSchema.pre('updateMany', function(next) {
  next(new Error('Superadmin audit logs cannot be updated'));
});

/**
 * Pre-delete Hooks: Prevent Deletes
 * 
 * These hooks block any attempt to delete audit logs.
 */
superadminAuditSchema.pre('deleteOne', function(next) {
  next(new Error('Superadmin audit logs cannot be deleted'));
});

superadminAuditSchema.pre('deleteMany', function(next) {
  next(new Error('Superadmin audit logs cannot be deleted'));
});

superadminAuditSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Superadmin audit logs cannot be deleted'));
});

// Composite index for performance - query by performer and timestamp
superadminAuditSchema.index({ performedBy: 1, timestamp: -1 });
superadminAuditSchema.index({ targetEntityType: 1, targetEntityId: 1 });

module.exports = mongoose.model('SuperadminAudit', superadminAuditSchema);
