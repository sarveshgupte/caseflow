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
   * Required for accountability
   */
  createdBy: {
    type: String,
    required: [true, 'Creator email is required'],
    lowercase: true,
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
 */
commentSchema.index({ caseId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
