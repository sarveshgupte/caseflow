const mongoose = require('mongoose');

/**
 * Client Model for Docketra Case Management System
 * 
 * Represents clients/customers with audit-safe management.
 * Clients are immutable after creation - edits must happen through "Client - Edit" cases.
 * 
 * Key Features:
 * - Auto-incrementing clientId (CL-0001, CL-0002, etc.)
 * - Soft delete mechanism (no hard deletes)
 * - Immutable after creation (edits require workflow approval)
 * - Comprehensive contact information tracking
 */

const clientSchema = new mongoose.Schema({
  /**
   * Auto-generated human-readable client identifier
   * Format: CL-XXXX (e.g., CL-0001, CL-0042)
   * Generated via pre-save hook by finding highest existing number and incrementing
   */
  clientId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
  },
  
  /**
   * Client name
   * Required and unique to prevent duplicate clients
   */
  name: {
    type: String,
    required: [true, 'Client name is required'],
    unique: true,
    trim: true,
  },
  
  /**
   * Contact information for the client
   * Stores email, phone, and address details
   */
  contactInfo: {
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
  },
  
  /**
   * Soft delete mechanism
   * When false, client is considered deleted without removing from database
   * Maintains data integrity and audit trail
   */
  isActive: {
    type: Boolean,
    default: true,
  },
  
  /**
   * Email of user who created the client
   * Required for accountability and audit trail
   * Only Admin users can create clients
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
 * Generates sequential human-readable IDs in format CL-XXXX
 * Algorithm:
 * 1. Find the highest existing clientId number
 * 2. Increment by 1
 * 3. Format as CL- prefix + 4-digit zero-padded number
 * 
 * Note: This runs before validation, so clientId is available for unique constraint check
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
      // The regex ensures we only match our format: CL-XXXX
      // The zero-padding ensures proper string-based sorting (CL-0001 < CL-0010 < CL-0100)
      const lastClient = await this.constructor.findOne(
        { clientId: /^CL-\d{4}$/ },
        { clientId: 1 }
      ).sort({ clientId: -1 }).lean();
      
      let nextNumber = 1;
      
      if (lastClient && lastClient.clientId) {
        // Extract the number from CL-XXXX format
        const match = lastClient.clientId.match(/^CL-(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      
      // Format as CL-XXXX with zero-padding to 4 digits
      this.clientId = `CL-${nextNumber.toString().padStart(4, '0')}`;
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
 * - name: Unique index (automatic from schema definition) for lookups
 * - isActive: For filtering active vs inactive clients
 */
clientSchema.index({ isActive: 1 });

module.exports = mongoose.model('Client', clientSchema);
