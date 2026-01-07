const mongoose = require('mongoose');

/**
 * UserProfile Model for Docketra Case Management System
 * 
 * Stores mutable user profile information separate from core identity
 * xID and name are immutable and stored in User model
 * All other profile fields can be updated by the user
 */

const userProfileSchema = new mongoose.Schema({
  // Reference to User via xID (immutable)
  xID: {
    type: String,
    required: true,
    ref: 'User',
    unique: true,
  },
  
  // Date of birth
  dob: Date,
  
  // Phone number
  phone: String,
  
  // Address information
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
  },
  
  // PAN card number (uppercase)
  pan: {
    type: String,
    uppercase: true,
  },
  
  // Aadhaar number
  aadhaar: {
    type: String,
  },
  
  // Email address (can be different from User.email)
  email: {
    type: String,
    lowercase: true,
  },
  
  // Last update timestamp
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
userProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for performance
// Note: xID already has unique index from schema definition (unique: true)

module.exports = mongoose.model('UserProfile', userProfileSchema);
