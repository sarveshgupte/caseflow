const mongoose = require('mongoose');

/**
 * Client Model for Docketra Case Management System
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
 * 
 * REQUIRED FIELDS:
 * - clientId (auto-generated server-side)
 * - businessName
 * - businessAddress
 * - businessEmail
 * - primaryContactNumber
 * - createdByXid (set from authenticated user)
 * 
 * OPTIONAL FIELDS:
 * - secondaryContactNumber
 * - PAN, TAN, GST, CIN (tax/regulatory identifiers)
 */

const clientSchema = new mongoose.Schema({
  /**
   * Auto-generated immutable client identifier
   * Format: C000001, C000002, etc. (firm-scoped)
   * Generated via pre-save hook by finding highest existing number and incrementing
   * IMMUTABLE - Cannot be changed after creation
   * FIRM-SCOPED - Each firm starts with C000001
   */
  clientId: {
    type: String,
    required: true,
    trim: true,
    immutable: true, // Schema-level immutability enforcement
  },
  
  // Firm/Organization ID for multi-tenancy
  // Every client MUST belong to a firm
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: [true, 'Firm ID is required'],
    immutable: true, // Client cannot be moved between firms
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
   * Client Fact Sheet - Description
   * Admin-managed context about the client
   * Read-only reference visible in all cases for this client
   * Used for providing client background, notes, guidelines
   * Rich text field for detailed client information
   */
  clientFactSheet: {
    description: {
      type: String,
      trim: true,
      default: '',
    },
    /**
     * Client Fact Sheet - Internal Notes
     * Admin-only internal notes about the client
     * Used for internal context, guidelines, or sensitive information
     * Rich text field
     */
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    /**
     * Internal initialization flag
     * Tracks whether fact sheet has been initialized (for accurate audit logging)
     * Not exposed via APIs
     */
    _initialized: {
      type: Boolean,
      default: false,
      select: false, // Don't include in query results by default
    },
    /**
     * Client Fact Sheet - Files
     * Array of file references attached at client level
     * Admin-managed, visible as read-only in all cases
     * Not copied into individual cases
     * 
     * Each file contains:
     * - fileId: MongoDB ObjectId for the file
     * - fileName: Original file name
     * - mimeType: File MIME type
     * - storagePath: Path to file in storage
     * - uploadedBy: xID of user who uploaded
     * - uploadedAt: Timestamp
     */
    files: [{
      fileId: {
        type: mongoose.Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId(),
      },
      fileName: {
        type: String,
        required: true,
        trim: true,
      },
      mimeType: {
        type: String,
        required: true,
        trim: true,
      },
      storagePath: {
        type: String,
        required: true,
        trim: true,
      },
      uploadedByXID: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
    }],
  },
  
  /**
   * DEPRECATED: Legacy description field
   * Kept for backward compatibility
   * Use clientFactSheet.description instead
   */
  description: {
    type: String,
    trim: true,
    default: '',
  },
  
  /**
   * DEPRECATED: Legacy documents field
   * Kept for backward compatibility
   * Use clientFactSheet.files instead
   */
  documents: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    uploadedByXid: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
  }],
  
  /**
   * Google Drive folder structure for Client CFS (Client File System)
   * 
   * Stores the Google Drive folder IDs for this client's file structure.
   * Created automatically during client creation.
   * 
   * Structure:
   * - clientRootFolderId: client_<clientId> folder
   * - cfsRootFolderId: cfs/ subfolder
   * - documentsFolderId: documents/ subfolder
   * - contractsFolderId: contracts/ subfolder
   * - identityFolderId: identity/ subfolder
   * - financialsFolderId: financials/ subfolder
   * - internalFolderId: internal/ subfolder
   * 
   * Security:
   * - Folder IDs are authoritative for file access
   * - Never rely on folder names for authorization
   * - All file operations must use these IDs
   * - Only Admin users can add/remove documents
   * - Cases can reference these documents (read-only)
   */
  drive: {
    clientRootFolderId: {
      type: String,
      trim: true,
    },
    cfsRootFolderId: {
      type: String,
      trim: true,
    },
    documentsFolderId: {
      type: String,
      trim: true,
    },
    contractsFolderId: {
      type: String,
      trim: true,
    },
    identityFolderId: {
      type: String,
      trim: true,
    },
    financialsFolderId: {
      type: String,
      trim: true,
    },
    internalFolderId: {
      type: String,
      trim: true,
    },
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
   * Internal client flag - represents the firm itself
   * Auto-created by the system during firm creation/backfill
   */
  isInternal: {
    type: Boolean,
    default: false,
    immutable: true,
    index: true,
  },

  /**
   * System provenance for auto-created clients
   */
  createdBySystem: {
    type: Boolean,
    default: false,
    immutable: true,
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
 * Pre-save Hook: Auto-generate clientId (Fallback)
 * 
 * DEPRECATION NOTICE: This hook serves as a fallback only.
 * clientId generation should now happen explicitly in the controller via clientIdGenerator service.
 * 
 * Generates sequential IDs in format C000001 (no dash, 6 digits minimum)
 * Algorithm:
 * 1. Find the highest existing clientId number
 * 2. Increment by 1
 * 3. Format as C prefix + number (minimum 6 digits)
 * 
 * Note: Only runs if clientId is not already set (defensive fallback)
 * 
 * LIMITATION: This fallback implementation has a potential race condition with concurrent saves.
 * The controller should use clientIdGenerator service which uses atomic Counter operations.
 */
clientSchema.pre('save', async function() {
  // Only generate clientId if it's not already set (fallback for legacy/emergency use)
  if (!this.clientId) {
    console.warn('[Client Model] Pre-save hook generating clientId (fallback). Should be generated in controller.');
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
 * Validation: isSystemClient integrity
 * When a client is marked as isSystemClient=true, it must be the default client for its firm.
 * This validation runs on save operations.
 */
clientSchema.pre('save', async function() {
  // Only validate if isSystemClient is true
  if (this.isSystemClient === true && this.firmId) {
    try {
      const Firm = require('./Firm.model');
      const firm = await Firm.findById(this.firmId);
      
      if (firm && firm.defaultClientId) {
        // If firm has a defaultClientId, this client must match it
        if (firm.defaultClientId.toString() !== this._id.toString()) {
          const error = new Error('A system client must be the firm\'s default client');
          error.name = 'ValidationError';
          throw error;
        }
      }
    } catch (error) {
      // Re-throw validation errors to stop the save
      if (error.name === 'ValidationError') {
        throw error;
      }
      // For other errors (network/DB), log and allow the save to continue
      console.warn('[Client Validation] Could not verify isSystemClient constraint:', error.message);
    }
  }
});

/**
 * Performance Indexes
 * 
 * CRITICAL: Firm-scoped unique index on (firmId, clientId)
 * - Each firm has its own C000001, C000002, etc.
 * - clientId is unique WITHIN a firm, not globally
 * 
 * Other indexes:
 * - businessName: For lookups and searches
 * - isActive: For filtering active vs inactive clients
 * - isSystemClient: For identifying system clients
 * - createdByXid: For ownership queries (canonical identifier)
 * - firmId: For multi-tenancy queries
 */
// MANDATORY: Firm-scoped unique index on (firmId, clientId)
clientSchema.index({ firmId: 1, clientId: 1 }, { unique: true });

clientSchema.index({ isActive: 1 });
clientSchema.index({ isSystemClient: 1 });
clientSchema.index({ businessName: 1 });
clientSchema.index({ createdByXid: 1 }); // CANONICAL - xID-based creator queries
// REMOVED: { firmId: 1 } - redundant with compound indexes above
clientSchema.index({ firmId: 1, status: 1 }); // Firm-scoped status queries
// Enforce one internal client per firm - critical for firm onboarding integrity
clientSchema.index({ firmId: 1, isInternal: 1 }, { 
  unique: true, 
  partialFilterExpression: { isInternal: true },
  name: 'firm_internal_client_unique'
});

module.exports = mongoose.model('Client', clientSchema);
