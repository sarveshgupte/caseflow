const mongoose = require('mongoose');

/**
 * CaseAudit Model for Docketra Case Management System
 * 
 * IMMUTABLE AUDIT LOG - NO UPDATES OR DELETES ALLOWED
 * 
 * This collection serves as an append-only audit trail for case-related actions
 * including views, comments, attachments, and other activities.
 * 
 * Key Characteristics:
 * - Append-only: New entries are added via create operations only
 * - Immutable: Updates are blocked at schema level
 * - Never delete: Entries must be retained for legal/compliance requirements
 * - Comprehensive: Captures who did what, when, with xID attribution
 * 
 * Use Cases:
 * - Compliance audits
 * - View tracking for non-owned cases
 * - Activity monitoring
 * - Security investigations
 * 
 * IMPORTANT: Never modify or delete entries from this collection.
 * If you need to correct information, create a new corrective entry.
 */

const caseAuditSchema = new mongoose.Schema({
  /**
   * Reference to the case this audit entry belongs to
   * Stored as string to match Case.caseId (e.g., "CASE-20260109-00001")
   */
  caseId: {
    type: String,
    required: [true, 'Case ID is required'],
    index: true,
  },
  
  /**
   * Type of action performed on the case
   * 
   * Action types:
   * - CASE_VIEWED: Case accessed in view mode
   * - CASE_COMMENT_ADDED: Comment added to case
   * - CASE_FILE_ATTACHED: File uploaded to case
   * - CASE_CLOSED_VIEWED: User closed view mode
   * - CASE_EDITED: Case details modified
   * - CASE_ASSIGNED: Case assigned to user
   * - CASE_STATUS_CHANGED: Case status updated
   */
  actionType: {
    type: String,
    required: [true, 'Action type is required'],
    enum: [
      'CASE_VIEWED',
      'CASE_COMMENT_ADDED',
      'CASE_FILE_ATTACHED',
      'CASE_CLOSED_VIEWED',
      'CASE_EDITED',
      'CASE_ASSIGNED',
      'CASE_STATUS_CHANGED',
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
   * Can store context like file names, comment previews, etc.
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
caseAuditSchema.pre('updateOne', function(next) {
  next(new Error('CaseAudit entries cannot be updated. This is an immutable audit log.'));
});

caseAuditSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('CaseAudit entries cannot be updated. This is an immutable audit log.'));
});

caseAuditSchema.pre('updateMany', function(next) {
  next(new Error('CaseAudit entries cannot be updated. This is an immutable audit log.'));
});

/**
 * Pre-delete Hooks: Prevent Deletes
 * 
 * These hooks block any attempt to delete audit entries.
 */
caseAuditSchema.pre('deleteOne', function(next) {
  next(new Error('CaseAudit entries cannot be deleted. This is an immutable audit log.'));
});

caseAuditSchema.pre('deleteMany', function(next) {
  next(new Error('CaseAudit entries cannot be deleted. This is an immutable audit log.'));
});

caseAuditSchema.pre('findOneAndDelete', function(next) {
  next(new Error('CaseAudit entries cannot be deleted. This is an immutable audit log.'));
});

/**
 * Performance Indexes
 * 
 * - Compound Index (caseId + timestamp): Primary query pattern
 * - performedByXID: Secondary index for user activity tracking
 * - actionType: For filtering by specific action types
 */
caseAuditSchema.index({ caseId: 1, timestamp: -1 });
caseAuditSchema.index({ performedByXID: 1 });
caseAuditSchema.index({ actionType: 1 });

module.exports = mongoose.model('CaseAudit', caseAuditSchema);
