const mongoose = require('mongoose');

/**
 * Client Model for Caseflow Case Management System
 * 
 * Enterprise-grade immutable client identity system with audit-safe management.
 * Clients are immutable after creation - edits must happen through "Client - Edit" cases.
 * 
 * Key Features:
 * - Auto-incrementing clientId (C123456 format)
 * - Immutable clientId (enforced at schema level)
 * - System client flag for default organization client
 * - Comprehensive business and regulatory information
 * - Soft delete mechanism (no hard deletes)
 * - All edits require Admin approval through case workflow
 */

const clientSchema = new mongoose.Schema({
  /**
   * Auto-generated immutable client identifier
   * Format: C123456 (e.g., C123456, C123457)
   * Generated via pre-save hook by finding highest existing number and incrementing
   * IMMUTABLE - Cannot be changed after creation
   */
  clientId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    immutable: true, // Schema-level immutability enforcement
  },
  
  /**
   * Business/Client name
   * Required field for client identification
   */
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
  },
  
  /**
   * Business physical address
   * Required for regulatory and contact purposes
   */
  businessAddress: {
    type: String,
    required: [true, 'Business address is required'],
    trim: true,
  },
  
  /**
   * Business contact phone number
   * Required for communication
   */
  businessPhone: {
    type: String,
    required: [true, 'Business phone is required'],
    trim: true,
  },
  
  /**
   * Business contact email
   * Required for communication
   */
  businessEmail: {
    type: String,
    required: [true, 'Business email is required'],
    lowercase: true,
    trim: true,
  },
  
  /**
   * PAN (Permanent Account Number)
   * Indian tax identifier
   */
  PAN: {
    type: String,
    trim: true,
    uppercase: true,
  },
  
  /**
   * GST (Goods and Services Tax) Number
   * Indian tax registration number
   */
  GST: {
    type: String,
    trim: true,
    uppercase: true,
  },
  
  /**
   * CIN (Corporate Identification Number)
   * Indian company registration number
   */
  CIN: {
    type: String,
    trim: true,
    uppercase: true,
  },
  
  /**
   * Latitude for location mapping
   * Optional, for future Google Maps integration
   */
  latitude: {
    type: Number,
  },
  
  /**
   * Longitude for location mapping
   * Optional, for future Google Maps integration
   */
  longitude: {
    type: Number,
  },
  
  /**
   * System client flag
   * TRUE only for the default organization client (C123456)
   * System clients cannot be deleted or edited directly
   */
  isSystemClient: {
    type: Boolean,
    default: false,
    immutable: true, // Cannot change after creation
  },
  
  /**
   * Soft delete mechanism
   * When false, client is considered deleted without removing from database
   * Maintains data integrity and audit trail
   * System clients (isSystemClient: true) cannot be deactivated
   */
  isActive: {
    type: Boolean,
    default: true,
  },
  
  /**
   * Email of user who created the client
   * Required for accountability and audit trail
   * Only Admin users can create clients (via case approval)
   */
  createdBy: {
    type: String,
    required: [true, 'Creator email is required'],
    lowercase: true,
    trim: true,
  },
}, {
  // Automatic timestamp management for audit trail
  timestamps: true,
});

/**
 * Pre-save Hook: Auto-generate clientId
 * 
 * Generates sequential IDs in format C123456 (no dash, 6 digits minimum)
 * Algorithm:
 * 1. Find the highest existing clientId number
 * 2. Increment by 1
 * 3. Format as C prefix + number (minimum 6 digits)
 * 
 * First client is always C123456 (reserved for organization)
 * 
 * Note: This runs before validation, so clientId is available for unique constraint check
 * 
 * LIMITATION: String-based sorting works correctly up to C999999. Beyond that,
 * C1000000 would sort before C999999 in string order. For production systems
 * expecting more than ~877,000 clients, consider using a dedicated counter collection
 * or numeric-based sorting with zero-padding.
 * 
 * LIMITATION: This implementation has a potential race condition with concurrent saves.
 * For production use with high concurrency, consider using MongoDB's findOneAndUpdate 
 * with atomic increment or a dedicated counter collection.
 */
clientSchema.pre('save', async function(next) {
  // Only generate clientId if it's not already set (for new documents)
  if (!this.clientId) {
    try {
      // Find the client with the highest clientId number
      // The regex ensures we only match our format: C followed by digits
      const lastClient = await this.constructor.findOne(
        { clientId: /^C\d+$/ },
        { clientId: 1 }
      ).sort({ clientId: -1 }).lean();
      
      let nextNumber = 123456; // Start with organization client
      
      if (lastClient && lastClient.clientId) {
        // Extract the number from C123456 format
        const match = lastClient.clientId.match(/^C(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      
      // Format as C + number
      this.clientId = `C${nextNumber}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

/**
 * Performance Indexes
 * 
 * - clientId: Unique index (automatic from schema definition)
 * - businessName: For lookups and searches
 * - isActive: For filtering active vs inactive clients
 * - isSystemClient: For identifying system clients
 */
clientSchema.index({ isActive: 1 });
clientSchema.index({ isSystemClient: 1 });
clientSchema.index({ businessName: 1 });

module.exports = mongoose.model('Client', clientSchema);
