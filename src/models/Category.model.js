const mongoose = require('mongoose');

/**
 * Category Model for Docketra Case Management System
 * 
 * Represents centralized case categories for organization and access control.
 * Categories can be system-defined (cannot be deleted) or user-defined.
 * 
 * Key Features:
 * - System categories (isSystem: true) are protected from deletion
 * - Soft delete mechanism (no hard deletes)
 * - Unique category names
 * - Used for case classification and employee access control
 */

const categorySchema = new mongoose.Schema({
  /**
   * Category name
   * Required and unique to prevent duplicate categories
   * Used in Case model's category field and User model's allowedCategories
   */
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
  },
  
  /**
   * System category flag
   * When true, category is system-defined and cannot be deleted or deactivated
   * Default categories seeded by seedCategories.js script are marked as system
   */
  isSystem: {
    type: Boolean,
    default: false,
  },
  
  /**
   * Soft delete mechanism
   * When false, category is considered deleted without removing from database
   * Maintains data integrity and audit trail
   * System categories (isSystem: true) cannot be deactivated
   */
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  // Automatic timestamp management for audit trail
  timestamps: true,
});

/**
 * Performance Indexes
 * 
 * - name: Unique index (automatic from schema definition) for fast lookups
 * - isActive: For filtering active vs inactive categories
 */
categorySchema.index({ isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);
