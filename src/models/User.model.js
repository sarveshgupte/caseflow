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
  
  // Email address - REQUIRED for password setup emails
  // Used for notifications, contact, and password setup
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
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
  // Also called 'active' in some contexts
  isActive: {
    type: Boolean,
    default: true,
  },
  
  // Login protection: track failed login attempts
  failedLoginAttempts: {
    type: Number,
    default: 0,
  },
  
  // Login protection: timestamp until which account is locked
  lockUntil: {
    type: Date,
    default: null,
  },
  
  // Bcrypt hashed password - null until user sets password via email link
  passwordHash: {
    type: String,
    default: null,
  },
  
  // Indicates if user has set their password (via email link)
  passwordSet: {
    type: Boolean,
    default: false,
  },
  
  // Secure token hash for password setup (stored as hash, never plain text)
  passwordSetupTokenHash: {
    type: String,
    default: null,
  },
  
  // Expiry timestamp for password setup token (e.g., 24 hours from creation)
  passwordSetupExpires: {
    type: Date,
    default: null,
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

// Virtual property to check if account is locked
userSchema.virtual('isLocked').get(function() {
  // Check if lockUntil exists and is in the future
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

module.exports = mongoose.model('User', userSchema);
