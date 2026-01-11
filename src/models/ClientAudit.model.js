const mongoose = require('mongoose');

/**
 * ClientAudit Model for Docketra Case Management System
 * 
 * IMMUTABLE AUDIT LOG - NO UPDATES OR DELETES ALLOWED
 * 
 * This collection serves as an append-only audit trail for client-related actions
 * including fact sheet creation, updates, file operations, and views.
 * 
 * Key Characteristics:
 * - Append-only: New entries are added via create operations only
 * - Immutable: Updates are blocked at schema level
 * - Never delete: Entries must be retained for legal/compliance requirements
 * - Comprehensive: Captures who did what, when, with xID attribution
 * 
 * Use Cases:
 * - Compliance audits
 * - Client data change tracking
 * - Activity monitoring
 * - Security investigations
 * 
 * IMPORTANT: Never modify or delete entries from this collection.
 * If you need to correct information, create a new corrective entry.
 */

const clientAuditSchema = new mongoose.Schema({
  /**
   * Reference to the client this audit entry belongs to
   * Stored as string to match Client.clientId (e.g., "C000001")
   */
  clientId: {
    type: String,
    required: [true, 'Client ID is required'],
    index: true,
  },
  
  /**
   * Firm/Organization ID for multi-tenancy
   */
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm ID is required'],
    index: true,
  },
  
  /**
   * Type of action performed on the client
   * 
   * Action types:
   * - CLIENT_FACT_SHEET_CREATED: Fact sheet created
   * - CLIENT_FACT_SHEET_UPDATED: Fact sheet updated
   * - CLIENT_FACT_SHEET_FILE_ADDED: File uploaded to fact sheet
   * - CLIENT_FACT_SHEET_FILE_REMOVED: File deleted from fact sheet
   * - CLIENT_FACT_SHEET_VIEWED: Fact sheet viewed in case context
   */
  actionType: {
    type: String,
    required: [true, 'Action type is required'],
    enum: [
      'CLIENT_FACT_SHEET_CREATED',
      'CLIENT_FACT_SHEET_UPDATED',
      'CLIENT_FACT_SHEET_FILE_ADDED',
      'CLIENT_FACT_SHEET_FILE_REMOVED',
      'CLIENT_FACT_SHEET_VIEWED',
    ],
  },
  
  /**
   * Human-readable description of what occurred
   * Should be clear enough for audit purposes
   */
  description: {
    type: String,
    required: [true, 'Description is required'],
  },
  
  /**
   * xID of user who performed the action
   * CANONICAL IDENTIFIER - always use xID, never email
   * Format: X123456
   */
  performedByXID: {
    type: String,
    required: [true, 'Performer xID is required'],
    uppercase: true,
    trim: true,
  },
  
  /**
   * When the action occurred
   * Immutable to prevent tampering with audit timeline
   * Auto-set to current time
   */
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  
  /**
   * Additional metadata about the action (optional)
   * Can store context like file names, changes made, etc.
   */
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  },
}, {
  // Strict mode: Prevents adding arbitrary fields not defined in schema
  strict: true,
  // No automatic timestamps - we manage this manually via 'timestamp' field
  timestamps: false,
});

/**
 * Pre-update Hooks: Prevent Updates
 * 
 * These hooks block any attempt to update existing audit entries.
 * Audit entries must be immutable for compliance.
 */
clientAuditSchema.pre('updateOne', function(next) {
  next(new Error('ClientAudit entries cannot be updated. This is an immutable audit log.'));
});

clientAuditSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('ClientAudit entries cannot be updated. This is an immutable audit log.'));
});

clientAuditSchema.pre('updateMany', function(next) {
  next(new Error('ClientAudit entries cannot be updated. This is an immutable audit log.'));
});

/**
 * Pre-delete Hooks: Prevent Deletes
 * 
 * These hooks block any attempt to delete audit entries.
 */
clientAuditSchema.pre('deleteOne', function(next) {
  next(new Error('ClientAudit entries cannot be deleted. This is an immutable audit log.'));
});

clientAuditSchema.pre('deleteMany', function(next) {
  next(new Error('ClientAudit entries cannot be deleted. This is an immutable audit log.'));
});

clientAuditSchema.pre('findOneAndDelete', function(next) {
  next(new Error('ClientAudit entries cannot be deleted. This is an immutable audit log.'));
});

/**
 * Performance Indexes
 * 
 * - Compound Index (clientId + timestamp): Primary query pattern
 * - performedByXID: Secondary index for user activity tracking
 * - actionType: For filtering by specific action types
 * - firmId: Multi-tenancy queries
 */
clientAuditSchema.index({ clientId: 1, timestamp: -1 });
clientAuditSchema.index({ performedByXID: 1 });
clientAuditSchema.index({ actionType: 1 });
clientAuditSchema.index({ firmId: 1 });
clientAuditSchema.index({ firmId: 1, clientId: 1 }); // Firm-scoped client audits

module.exports = mongoose.model('ClientAudit', clientAuditSchema);
