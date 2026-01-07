const mongoose = require('mongoose');

/**
 * Attachment Model for Docketra Case Management System
 * 
 * IMMUTABLE - NO UPDATES OR DELETES ALLOWED
 * 
 * This model stores file attachments for cases with mandatory descriptions.
 * Attachments are stored locally using multer.
 * 
 * Attachments are allowed on: Open, Pending, Closed statuses
 * Attachments are NOT allowed on: Filed status
 * Attachments are NOT editable or deletable once created
 */

const attachmentSchema = new mongoose.Schema({
  /**
   * Reference to the case this attachment belongs to
   * Stored as string to match Case.caseId (e.g., "DCK-0001")
   */
  caseId: {
    type: String,
    required: [true, 'Case ID is required'],
    index: true,
  },
  
  /**
   * Original file name
   */
  fileName: {
    type: String,
    required: [true, 'File name is required'],
  },
  
  /**
   * Local storage path for the file
   */
  filePath: {
    type: String,
    required: [true, 'File path is required'],
  },
  
  /**
   * Description of the attachment (MANDATORY)
   */
  description: {
    type: String,
    required: [true, 'Description is required'],
  },
  
  /**
   * Email of user who uploaded the attachment
   * Required for accountability
   */
  createdBy: {
    type: String,
    required: [true, 'Creator email is required'],
    lowercase: true,
    trim: true,
  },
  
  /**
   * When the attachment was uploaded
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
 * These hooks block any attempt to update existing attachments.
 * Attachments must be immutable for audit integrity.
 */
attachmentSchema.pre('updateOne', function(next) {
  next(new Error('Attachments cannot be updated. Attachments are immutable.'));
});

attachmentSchema.pre('findOneAndUpdate', function(next) {
  next(new Error('Attachments cannot be updated. Attachments are immutable.'));
});

attachmentSchema.pre('updateMany', function(next) {
  next(new Error('Attachments cannot be updated. Attachments are immutable.'));
});

/**
 * Pre-delete Hooks: Prevent Deletes
 * 
 * These hooks block any attempt to delete attachments.
 */
attachmentSchema.pre('deleteOne', function(next) {
  next(new Error('Attachments cannot be deleted. Attachments are immutable.'));
});

attachmentSchema.pre('deleteMany', function(next) {
  next(new Error('Attachments cannot be deleted. Attachments are immutable.'));
});

attachmentSchema.pre('findOneAndDelete', function(next) {
  next(new Error('Attachments cannot be deleted. Attachments are immutable.'));
});

/**
 * Performance Indexes
 */
attachmentSchema.index({ caseId: 1, createdAt: -1 });

module.exports = mongoose.model('Attachment', attachmentSchema);
