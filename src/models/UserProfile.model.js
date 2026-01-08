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
  
  // Alias for dateOfBirth (follows PR requirements)
  dateOfBirth: {
    type: Date,
    get: function() { return this.dob; },
    set: function(value) { this.dob = value; },
  },
  
  // Gender
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', ''],
    default: '',
  },
  
  // Phone number
  phone: String,
  
  // Address information
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
  },
  
  // PAN card number (uppercase) - MUST be masked (e.g., ABCDE1234F)
  pan: {
    type: String,
    uppercase: true,
  },
  
  // Alias for panMasked (follows PR requirements)
  panMasked: {
    type: String,
    get: function() { return this.pan; },
    set: function(value) { this.pan = value; },
  },
  
  // Aadhaar number - MUST be masked (e.g., XXXX-XXXX-1234)
  aadhaar: {
    type: String,
  },
  
  // Alias for aadhaarMasked (follows PR requirements)
  aadhaarMasked: {
    type: String,
    get: function() { return this.aadhaar; },
    set: function(value) { this.aadhaar = value; },
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
}, {
  // Enable virtuals in JSON output
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
});

// Update timestamp on save
userProfileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for performance
// Note: xID already has unique index from schema definition (unique: true)

module.exports = mongoose.model('UserProfile', userProfileSchema);
