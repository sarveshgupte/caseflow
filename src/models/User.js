const mongoose = require('mongoose');

/**
 * User Model for Docketra Case Management System
 * Represents users with role-based access control
 * Supports Admin (full access) and Employee (category-restricted access)
 */

const userSchema = new mongoose.Schema({
  // Primary identifier for users; unique constraint prevents duplicates
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  // Authentication credential; use placeholder hashing logic (bcrypt structure)
  // TODO: Implement actual password hashing with bcrypt before production
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
  },
  // Determines access level: Admin has full system access, Employee has category-restricted access
  role: {
    type: String,
    enum: ['Admin', 'Employee'],
    default: 'Employee',
    required: true,
  },
  // Controls which case categories an Employee can access; empty array for Admin means access to all
  allowedCategories: {
    type: [String],
    default: [],
  },
  // Soft delete mechanism; allows disabling users without removing data
  isActive: {
    type: Boolean,
    default: true,
  },
  // Audit trail for user account creation
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for performance
// Note: email already has unique index from schema definition
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
