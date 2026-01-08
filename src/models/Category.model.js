const mongoose = require('mongoose');

/**
 * Category Model for Docketra Case Management System
 * 
 * Represents centralized case categories for organization and access control.
 * Admin-managed categories with nested subcategories for case classification.
 * 
 * Key Features:
 * - Unique category names
 * - Nested subcategories with unique names within each category
 * - Soft delete mechanism (isActive flag)
 * - Categories in use by cases cannot be deleted
 */

const subcategorySchema = new mongoose.Schema({
  /**
   * Subcategory ID (auto-generated)
   */
  id: {
    type: String,
    required: true,
  },
  
  /**
   * Subcategory name
   * Must be unique within the parent category
   */
  name: {
    type: String,
    required: [true, 'Subcategory name is required'],
    trim: true,
  },
  
  /**
   * Soft delete mechanism for subcategories
   * When false, subcategory is considered deleted
   */
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  _id: false, // Disable automatic _id generation for subdocuments
});

const categorySchema = new mongoose.Schema({
  /**
   * Category name
   * Required and unique to prevent duplicate categories
   * Used for case classification
   */
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true,
  },
  
  /**
   * Nested subcategories array
   * Subcategory names must be unique within the category
   */
  subcategories: {
    type: [subcategorySchema],
    default: [],
  },
  
  /**
   * Soft delete mechanism
   * When false, category is considered deleted without removing from database
   * Maintains data integrity and audit trail
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
