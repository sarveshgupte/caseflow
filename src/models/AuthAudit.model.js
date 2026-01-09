const mongoose = require('mongoose');

/**
 * AuthAudit Model for Docketra Case Management System
 * 
 * APPEND-ONLY - NO UPDATES OR DELETES ALLOWED
 * 
 * This model stores authentication and authorization audit logs
 * Enforces immutability to maintain accurate audit trail
 * All authentication-related actions must be logged here
 */

const authAuditSchema = new mongoose.Schema({
  // xID of user whose account this action relates to
  xID: {
    type: String,
    required: true,
    index: true,
  },
  
  // Firm/Organization ID for multi-tenancy
  firmId: {
    type: String,
    required: true,
    index: true,
  },
  
  // MongoDB ObjectId of user (for JWT-based queries)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  
  // Type of action performed
  actionType: {
    type: String,
    required: true,
    enum: [
      // User lifecycle events
      'UserCreated',
      'InviteEmailSent',
      'InviteEmailFailed',
      'InviteEmailResent',
      'InviteEmailResendFailed',
      'ProfileUpdated',
      'AccountActivated',
      'AccountDeactivated',
      
      // Authentication events
      'Login',
      'Logout',
      'LoginFailed',
      'AccountLocked',
      'AccountUnlocked',
      
      // Password management events
      'PasswordSetupEmailSent',
      'PasswordSetup',
      'PasswordChanged',
      'PasswordResetByAdmin',
      'PasswordExpired',
      'PasswordReset',
      'PasswordResetEmailSent',
      'ForgotPasswordRequested',
      
      // Token management events
      'TokenRefreshed',
      'RefreshTokenRevoked',
    ],
  },
  
  // Human-readable description of the action
  description: {
    type: String,
    required: true,
  },
  
  // xID of user who performed this action
  performedBy: {
    type: String,
    required: true,
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
authAuditSchema.pre('updateOne', function(next) {
  next(new Error('Audit logs cannot be updated'));
});

authAuditSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Audit logs cannot be updated'));
});

authAuditSchema.pre('updateMany', function(next) {
  next(new Error('Audit logs cannot be updated'));
});

/**
 * Pre-delete Hooks: Prevent Deletes
 * 
 * These hooks block any attempt to delete audit logs.
 */
authAuditSchema.pre('deleteOne', function(next) {
  next(new Error('Audit logs cannot be deleted'));
});

authAuditSchema.pre('deleteMany', function(next) {
  next(new Error('Audit logs cannot be deleted'));
});

authAuditSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Audit logs cannot be deleted'));
});

// Index for performance - query by xID and timestamp
authAuditSchema.index({ xID: 1, timestamp: -1 });
authAuditSchema.index({ actionType: 1 });
authAuditSchema.index({ firmId: 1, timestamp: -1 }); // Firm-scoped audit queries
authAuditSchema.index({ userId: 1, timestamp: -1 }); // User-scoped audit queries

module.exports = mongoose.model('AuthAudit', authAuditSchema);
