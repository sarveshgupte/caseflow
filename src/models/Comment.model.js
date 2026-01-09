const mongoose = require('mongoose');

/**
 * Comment Model for Docketra Case Management System
 * 
 * IMMUTABLE - NO UPDATES OR DELETES ALLOWED
 * 
 * This model stores comments on cases and enforces immutability
 * to maintain an accurate audit trail.
 * 
 * Comments are allowed on: Open, Pending, Closed, Filed statuses
 * Comments are NOT editable or deletable once created
 */

const commentSchema = new mongoose.Schema({
  /**
   * Reference to the case this comment belongs to
   * Stored as string to match Case.caseId (e.g., "DCK-0001")
   */
  caseId: {
    type: String,
    required: [true, 'Case ID is required'],
    index: true,
  },
  
  /**
   * The comment text content
   */
  text: {
    type: String,
    required: [true, 'Comment text is required'],
  },
  
  /**
   * Email of user who created the comment
   * ⚠️ DEPRECATED - FOR DISPLAY PURPOSES ONLY ⚠️
   * Use createdByXID and createdByName for UI display
   */
  createdBy: {
    type: String,
    required: [true, 'Creator email is required'],
    lowercase: true,
    trim: true,
  },
  
  /**
   * xID of user who created the comment
   * ✅ CANONICAL IDENTIFIER ✅
   * Format: X123456
   * Used for attribution and audit trails
   * 
   * Optional for backward compatibility with existing comments.
   * All new comments should include this field.
   */
  createdByXID: {
    type: String,
    uppercase: true,
    trim: true,
  },
  
  /**
   * Name of user who created the comment
   * Used for display in UI
   * 
   * Optional for backward compatibility with existing comments.
   * All new comments should include this field.
   */
  createdByName: {
    type: String,
    trim: true,
  },
  
  /**
   * When the comment was created
   * Immutable to prevent tampering
   */
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  
  /**
   * Optional note (e.g., "Cloned from Case ID: DCK-0042")
   */
  note: {
    type: String,
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
 * These hooks block any attempt to update existing comments.
 * Comments must be immutable for audit integrity.
 */
commentSchema.pre('updateOne', function(next) {
  next(new Error('Comments cannot be updated. Comments are immutable.'));
});

commentSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Comments cannot be updated. Comments are immutable.'));
});

commentSchema.pre('updateMany', function(next) {
  next(new Error('Comments cannot be updated. Comments are immutable.'));
});

/**
 * Pre-delete Hooks: Prevent Deletes
 * 
 * These hooks block any attempt to delete comments.
 */
commentSchema.pre('deleteOne', function(next) {
  next(new Error('Comments cannot be deleted. Comments are immutable.'));
});

commentSchema.pre('deleteMany', function(next) {
  next(new Error('Comments cannot be deleted. Comments are immutable.'));
});

commentSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Comments cannot be deleted. Comments are immutable.'));
});

/**
 * Performance Indexes
 * - caseId + createdAt: List comments for a case
 * - text: Full-text search index for global search
 */
commentSchema.index({ caseId: 1, createdAt: -1 });
commentSchema.index({ text: 'text' });

module.exports = mongoose.model('Comment', commentSchema);
