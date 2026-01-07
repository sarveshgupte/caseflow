const mongoose = require('mongoose');

/**
 * User Model for Docketra Case Management System
 * Represents users with role-based access control and xID-based authentication
 * Supports Admin (full access) and Employee (category-restricted access)
 * 
 * Key Features:
 * - xID-based authentication (X123456 format)
 * - Immutable xID and name fields
 * - Password expiry and history tracking
 * - Enterprise-grade identity management
 */

const userSchema = new mongoose.Schema({
  // Enterprise employee number - PRIMARY identifier
  // Format: X followed by 6 digits (e.g., X123456)
  // IMMUTABLE - Cannot be changed after creation
  xID: {
    type: String,
    required: [true, 'xID is required'],
    unique: true,
    uppercase: true,
    match: [/^X\d{6}$/, 'xID must be in format X123456'],
    immutable: true,
  },
  
  // User's full name
  // IMMUTABLE - Cannot be changed after creation
  name: {
    type: String,
    required: [true, 'Name is required'],
    immutable: true,
  },
  
  // Email address - NOT used for authentication
  // Used for notifications and contact only
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
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
  
  // Bcrypt hashed password
  passwordHash: {
    type: String,
    required: true,
  },
  
  // Timestamp of last password change
  passwordLastChangedAt: {
    type: Date,
    default: Date.now,
  },
  
  // Password expires 60 days after last change
  passwordExpiresAt: {
    type: Date,
    required: true,
  },
  
  // Store last 5 passwords to prevent reuse
  passwordHistory: [{
    hash: String,
    changedAt: Date,
  }],
  
  // Force password change on first login or after admin reset
  mustChangePassword: {
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
// Note: xID and email already have unique indexes from schema definition (unique: true)
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
