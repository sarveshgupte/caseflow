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
   * 
   * PROTECTED - Can only be changed via dedicated "Change Legal Name" endpoint
   * All changes are tracked in previousBusinessNames array
   */
  businessName: {
    type: String,
    required: [true, 'Business name is required'],
    trim: true,
  },
  
  /**
   * Previous business names history
   * Tracks all legal name changes for audit compliance
   * Each entry captures: old name, change date, who changed it, and reason
   */
  previousBusinessNames: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    changedOn: {
      type: Date,
      required: true,
      default: Date.now,
    },
    changedByXid: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    }
  }],
  
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
   * Primary contact phone number
   * Required for communication
   */
  primaryContactNumber: {
    type: String,
    required: [true, 'Primary contact number is required'],
    trim: true,
  },
  
  /**
   * Secondary contact phone number
   * Optional additional contact
   */
  secondaryContactNumber: {
    type: String,
    trim: true,
  },
  
  /**
   * Legacy field - kept for backward compatibility
   * Use primaryContactNumber for new implementations
   * @deprecated
   */
  businessPhone: {
    type: String,
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
   * IMMUTABLE - Cannot be changed after creation
   */
  PAN: {
    type: String,
    trim: true,
    uppercase: true,
    immutable: true,
  },
  
  /**
   * TAN (Tax Deduction and Collection Account Number)
   * Indian tax identifier for TDS
   * IMMUTABLE - Cannot be changed after creation
   */
  TAN: {
    type: String,
    trim: true,
    uppercase: true,
    immutable: true,
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
   * IMMUTABLE - Cannot be changed after creation
   */
  CIN: {
    type: String,
    trim: true,
    uppercase: true,
    immutable: true,
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
   * Client lifecycle status
   * ACTIVE: Client can be used for new cases
   * INACTIVE: Client cannot be used for new cases (soft delete)
   * Maintains data integrity and audit trail
   * System clients (isSystemClient: true) cannot be deactivated
   */
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE',
  },
  
  /**
   * Legacy soft delete flag - kept for backward compatibility
   * Use status field for new implementations
   * @deprecated
   */
  isActive: {
    type: Boolean,
    default: true,
  },
  
  /**
   * xID of user who created the client
   * 
   * ✅ CANONICAL IDENTIFIER - REQUIRED FOR OWNERSHIP ✅
   * 
   * This is the authoritative field for tracking who created the client.
   * Format: X123456
   * Immutable after creation
   * 
   * Set server-side from authenticated user context (req.user.xID)
   * NEVER accept this from client payload
   */
  createdByXid: {
    type: String,
    required: [true, 'Creator xID is required'],
    uppercase: true,
    trim: true,
    immutable: true,
  },
  
  /**
   * Email of user who created the client
   * 
   * ⚠️ DEPRECATED - FOR DISPLAY PURPOSES ONLY ⚠️
   * 
   * This field is kept for backward compatibility with existing client records.
   * 
   * NEVER use this field for:
   * - Ownership logic
   * - Authorization checks
   * - Client queries
   * 
   * ALWAYS use createdByXid instead for all ownership and authorization logic.
   */
  createdBy: {
    type: String,
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
 * Generates sequential IDs in format C000001 (no dash, 6 digits minimum)
 * Algorithm:
 * 1. Find the highest existing clientId number
 * 2. Increment by 1
 * 3. Format as C prefix + number (minimum 6 digits)
 * 
 * First client is always C000001 (reserved for organization)
 * 
 * Note: This runs before validation, so clientId is available for unique constraint check
 * 
 * LIMITATION: String-based sorting works correctly up to C999999. Beyond that,
 * C1000000 would sort before C999999 in string order. For production systems
 * expecting more than ~1,000,000 clients, consider using a dedicated counter collection
 * or numeric-based sorting with zero-padding.
 * 
 * LIMITATION: This implementation has a potential race condition with concurrent saves.
 * For production use with high concurrency, consider using MongoDB's findOneAndUpdate 
 * with atomic increment or a dedicated counter collection.
 */
clientSchema.pre('save', async function() {
  // Only generate clientId if it's not already set (for new documents)
  if (!this.clientId) {
    // Find the client with the highest clientId number
    // The regex ensures we only match our format: C followed by digits
    const lastClient = await this.constructor.findOne(
      { clientId: /^C\d+$/ },
      { clientId: 1 }
    ).sort({ clientId: -1 }).lean();
    
    let nextNumber = 1; // Start with C000001 for organization client
    
    if (lastClient && lastClient.clientId) {
      // Extract the number from C000001 format
      const match = lastClient.clientId.match(/^C(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    // Format as C + 6-digit zero-padded number
    this.clientId = `C${nextNumber.toString().padStart(6, '0')}`;
  }
});

/**
 * Performance Indexes
 * 
 * - clientId: Unique index (automatic from schema definition)
 * - businessName: For lookups and searches
 * - isActive: For filtering active vs inactive clients
 * - isSystemClient: For identifying system clients
 * - createdByXid: For ownership queries (canonical identifier)
 */
clientSchema.index({ isActive: 1 });
clientSchema.index({ isSystemClient: 1 });
clientSchema.index({ businessName: 1 });
clientSchema.index({ createdByXid: 1 }); // CANONICAL - xID-based creator queries

module.exports = mongoose.model('Client', clientSchema);
