const mongoose = require('mongoose');

/**
 * CaseHistory Model for Docketra Case Management System
 * 
 * IMMUTABLE AUDIT LOG - NO UPDATES OR DELETES ALLOWED
 * 
 * This collection serves as an append-only audit trail for all case-related actions.
 * It is designed for compliance, forensics, and accountability purposes.
 * 
 * Key Characteristics:
 * - Append-only: New entries are added via create operations only
 * - Immutable: Updates are blocked at schema level
 * - Never delete: Entries must be retained for legal/compliance requirements
 * - Comprehensive: Captures who did what, when, and why
 * 
 * Use Cases:
 * - Compliance audits
 * - Dispute resolution
 * - Performance tracking
 * - Security investigations
 * 
 * IMPORTANT: Never modify or delete entries from this collection.
 * If you need to correct information, create a new corrective entry.
 */

const caseHistorySchema = new mongoose.Schema({
  /**
   * Reference to the case this history entry belongs to
   * Stored as string to match Case.caseId (e.g., "DCK-0001")
   * Could also be implemented as ObjectId reference if preferred
   */
  caseId: {
    type: String,
    required: [true, 'Case ID is required'],
    index: true,
  },
  
  /**
   * Type of action performed on the case
   * Categorizes the change for filtering and reporting
   * 
   * Common examples:
   * - Created: Case was created
   * - Updated: Case details modified
   * - StatusChanged: Status transition occurred
   * - Assigned: Case assigned to user
   * - Reassigned: Case moved to different user
   * - Closed: Case closed
   * - Reopened: Previously closed case reopened
   * - CommentAdded: Comment/note added
   * - DocumentAttached: File uploaded
   */
  actionType: {
    type: String,
    required: [true, 'Action type is required'],
  },
  
  /**
   * Human-readable description of what changed
   * Should be clear enough for audit purposes
   * 
   * Examples:
   * - "Status changed from Open to Pending"
   * - "Case assigned to john.doe@example.com"
   * - "Priority escalated from Medium to Urgent"
   * - "Due date updated to 2026-02-15"
   */
  description: {
    type: String,
    required: [true, 'Description is required'],
  },
  
  /**
   * xID of user who performed the action
   * 
   * ✅ CANONICAL IDENTIFIER - MANDATORY ✅
   * 
   * Format: X123456
   * Used for canonical attribution in audit trails
   * 
   * PR: xID Canonicalization - Added for canonical user identification
   */
  performedByXID: {
    type: String,
    uppercase: true,
    trim: true,
  },
  
  /**
   * Email of user who performed the action
   * 
   * ⚠️ DISPLAY ONLY ⚠️
   * 
   * Required for backward compatibility and display purposes
   * Use performedByXID for all logic and queries
   */
  performedBy: {
    type: String,
    required: [true, 'Performer email is required'],
    lowercase: true,
    trim: true,
  },
  
  /**
   * When the action occurred
   * Immutable to prevent tampering with audit timeline
   * Auto-set to current time, but can be overridden if needed
   */
  timestamp: {
    type: Date,
    default: Date.now,
    immutable: true, // Prevents modification after creation
  },
}, {
  // Strict mode: Prevents adding arbitrary fields not defined in schema
  strict: true,
  // No automatic timestamps - we manage this manually via 'timestamp' field
  timestamps: false,
});

/**
 * Pre-update Hook: Prevent Updates
 * 
 * This hook blocks any attempt to update existing history entries.
 * If an update is attempted, it throws an error.
 * 
 * Rationale: History entries must be immutable for audit integrity.
 */
caseHistorySchema.pre('updateOne', function(next) {
  next(new Error('CaseHistory entries cannot be updated. This is an immutable audit log.'));
});

caseHistorySchema.pre('findOneAndUpdate', function(next) {
  next(new Error('CaseHistory entries cannot be updated. This is an immutable audit log.'));
});

caseHistorySchema.pre('updateMany', function(next) {
  next(new Error('CaseHistory entries cannot be updated. This is an immutable audit log.'));
});

/**
 * Pre-delete Hooks: Prevent Deletes
 * 
 * These hooks block any attempt to delete history entries.
 * 
 * Rationale: Audit logs must be retained for legal compliance.
 * If storage is a concern, consider archiving to cold storage instead.
 * 
 * Note: The 'remove' hook is deprecated in Mongoose 6+, so we only use
 * the modern deletion hooks: deleteOne, deleteMany, and findOneAndDelete.
 */
caseHistorySchema.pre('deleteOne', function(next) {
  next(new Error('CaseHistory entries cannot be deleted. This is an immutable audit log.'));
});

caseHistorySchema.pre('deleteMany', function(next) {
  next(new Error('CaseHistory entries cannot be deleted. This is an immutable audit log.'));
});

caseHistorySchema.pre('findOneAndDelete', function(next) {
  next(new Error('CaseHistory entries cannot be deleted. This is an immutable audit log.'));
});

/**
 * Performance Indexes
 * 
 * - Compound Index (caseId + timestamp): Primary query pattern
 *   Used for retrieving history entries for a specific case in chronological order
 *   
 * - performedBy: Secondary index for user activity tracking (email-based, legacy)
 * - performedByXID: Secondary index for user activity tracking (xID-based, canonical)
 *   Used for queries like "show all actions by user X"
 */
caseHistorySchema.index({ caseId: 1, timestamp: -1 });
caseHistorySchema.index({ performedBy: 1 }); // Legacy
caseHistorySchema.index({ performedByXID: 1 }); // Canonical

/**
 * Export the CaseHistory model
 * 
 * Usage Example:
 * ```javascript
 * const CaseHistory = require('./models/CaseHistory.model');
 * 
 * // Creating a new entry (ALLOWED)
 * await CaseHistory.create({
 *   caseId: 'DCK-0001',
 *   actionType: 'StatusChanged',
 *   description: 'Status changed from Open to Pending',
 *   performedBy: 'admin@docketra.com'
 * });
 * 
 * // Updating an entry (BLOCKED - will throw error)
 * await CaseHistory.updateOne({ _id: someId }, { description: 'New desc' }); // ERROR
 * 
 * // Deleting an entry (BLOCKED - will throw error)
 * await CaseHistory.deleteOne({ _id: someId }); // ERROR
 * ```
 */
module.exports = mongoose.model('CaseHistory', caseHistorySchema);
