const mongoose = require('mongoose');

/**
 * Case Model for Docketra Case Management System
 * 
 * Represents a core case/matter with auto-generated human-readable IDs.
 * This model tracks the lifecycle of legal cases or business matters through
 * various statuses with proper validation and audit trails.
 * 
 * Key Features:
 * - Auto-incrementing caseId (DCK-0001, DCK-0002, etc.)
 * - Status-based validation (pendingUntil required for Pending status)
 * - Read-only protection for Closed/Filed cases
 * - Comprehensive indexing for performance
 */

const caseSchema = new mongoose.Schema({
  /**
   * ✅ INTERNAL CASE IDENTIFIER - TRUE DATABASE KEY ✅
   * 
   * Opaque, non-guessable internal identifier used for all database operations
   * Auto-generated ObjectId ensures uniqueness and prevents enumeration attacks
   * 
   * MANDATORY - Never editable
   * FIRM-SCOPED via indexes
   * 
   * ⚠️ CRITICAL: This is the ONLY identifier for:
   * - Internal DB queries: findOne({ caseInternalId })
   * - Authorization checks
   * - Cross-collection references
   * - API internal routing
   * 
   * 🚫 NEVER expose this in URLs or to end users
   * 
   * PR: Case Identifier Semantics - Separates internal IDs from display IDs
   */
  caseInternalId: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
    immutable: true,
  },
  
  /**
   * 📋 HUMAN-READABLE CASE NUMBER - DISPLAY ONLY 📋
   * 
   * Human-readable case identifier for display purposes ONLY
   * Format: CASE-YYYYMMDD-XXXXX (e.g., CASE-20260108-00012)
   * Generated via pre-save hook with daily sequence reset
   * 
   * MANDATORY - Never editable
   * FIRM-SCOPED - Case numbers reset per firm
   * 
   * ✅ USE THIS FOR:
   * - UI display in tables and lists
   * - Emails and PDFs
   * - User-facing reports
   * - Search by case number (with conversion to internal ID)
   * 
   * 🚫 NEVER use for:
   * - Authorization decisions
   * - Internal database queries (use caseInternalId)
   * - Direct lookups without conversion
   * 
   * PR: Case Identifier Semantics - Renamed from caseId for clarity
   */
  caseNumber: {
    type: String,
    required: true,
    trim: true,
    immutable: true,
    index: true,
  },
  
  /**
   * ⚠️ DEPRECATED - BACKWARD COMPATIBILITY ONLY ⚠️
   * 
   * Legacy field maintained for backward compatibility during transition
   * Will be removed in future release after migration period
   * 
   * DO NOT USE in new code - use caseNumber for display, caseInternalId for queries
   * 
   * This field is populated with the same value as caseNumber to maintain
   * backward compatibility with existing code during the transition period
   */
  caseId: {
    type: String,
    trim: true,
    immutable: true,
  },
  
  // Firm/Organization ID for multi-tenancy
  firmId: {
    type: String,
    required: [true, 'Firm ID is required'],
    index: true,
  },
  
  /**
   * Deterministic case name - DISPLAY ONLY
   * Format: caseYYYYMMDDxxxxx (e.g., case2026010700001)
   * Generated automatically at case creation
   * Unique within firm, immutable, resets daily
   * FIRM-SCOPED - Case names reset per firm
   * 
   * ⚠️ DISPLAY ONLY: Use only for human-readable display in tables/lists
   * 🚫 NEVER use for URLs, routes, queries, or navigation
   * 
   * PART E - Deterministic Case Naming
   */
  caseName: {
    type: String,
    required: true,
    trim: true,
    immutable: true,
  },
  
  /**
   * Brief description of the case/matter
   * MANDATORY field - provides clear case identification
   */
  title: {
    type: String,
    required: [true, 'Case title is required'],
    trim: true,
  },
  
  /**
   * Detailed information about the case
   * MANDATORY field - provides comprehensive case context
   */
  description: {
    type: String,
    required: [true, 'Case description is required'],
    trim: true,
  },
  
  /**
   * Classification for access control and organization
   * Used to determine which users can access this case
   * Legacy field - kept for backward compatibility
   */
  category: {
    type: String,
    trim: true,
  },
  
  /**
   * Primary case category - drives all workflows
   * Legacy field - kept for backward compatibility
   * Examples: 'Client - New', 'Client - Edit', 'Client - Delete', 'Sales', etc.
   */
  caseCategory: {
    type: String,
    trim: true,
  },
  
  /**
   * Legacy sub-category field
   * Kept for backward compatibility
   */
  caseSubCategory: {
    type: String,
    trim: true,
  },
  
  /**
   * Category ID - Reference to Category model
   * MANDATORY field for case classification
   * References admin-managed categories
   */
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
  },
  
  /**
   * Subcategory ID - Reference to subcategory within Category
   * MANDATORY field for detailed case classification
   */
  subcategoryId: {
    type: String,
    required: [true, 'Subcategory is required'],
    trim: true,
  },
  
  /**
   * Current lifecycle status of the case
   * 
   * ✅ CANONICAL LIFECYCLE STATES (New System):
   * - UNASSIGNED: Newly created case in global worklist, not yet assigned
   * - OPEN: Active case being worked on (appears in My Worklist)
   * - PENDED: Temporarily paused, waiting for external input (does NOT appear in My Worklist)
   * - RESOLVED: Case completed successfully
   * - FILED: Case archived and finalized (read-only, admin-visible only)
   * 
   * Additional workflow states:
   * - DRAFT: Being edited by creator
   * - SUBMITTED: Locked, awaiting review
   * - UNDER_REVIEW: Being reviewed by admin/approver
   * - APPROVED: Changes written to DB (for client cases)
   * - REJECTED: Declined, no DB mutation
   * - CLOSED: Completed and resolved
   * 
   * Legacy states (for backward compatibility):
   * - Open: Active and being worked on (use OPEN instead)
   * - Reviewed: Ready for Admin approval (used for client cases)
   * - Pending: Waiting for external input/decision (use PENDED instead)
   * - Filed: Archived and finalized (use FILED instead)
   * - Archived: Historical record (read-only)
   * 
   * PR: Case Lifecycle & Dashboard Logic
   * - OPEN cases: Appear in "My Open Cases" dashboard and "My Worklist"
   * - PENDED cases: Appear only in "My Pending Cases" dashboard (not in worklist)
   * - FILED cases: Hidden from employees, visible only to admins
   */
  status: {
    type: String,
    enum: {
      values: [
        // Canonical lifecycle states (NEW - use these)
        'UNASSIGNED', 'OPEN', 'PENDED', 'RESOLVED', 'FILED',
        // Additional workflow states
        'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED',
        // Legacy states (for backward compatibility - do NOT use for new code)
        'Open', 'Reviewed', 'Pending', 'Filed', 'Archived'
      ],
      message: '{VALUE} is not a valid status',
    },
    default: 'UNASSIGNED',
    required: true,
  },
  
  /**
   * Priority level for task prioritization and resource allocation
   */
  priority: {
    type: String,
    enum: {
      values: ['Low', 'Medium', 'High', 'Urgent'],
      message: '{VALUE} is not a valid priority',
    },
    default: 'Medium',
    required: true,
  },
  
  /**
   * Target completion date for the case
   * Optional to allow flexibility in case management
   */
  dueDate: {
    type: Date,
  },
  
  /**
   * Date when a Pending case should be reviewed
   * REQUIRED when status is 'Pending' (validated via custom validator)
   * Helps track cases waiting for external input
   */
  pendingUntil: {
    type: Date,
  },
  
  /**
   * SLA Due Date - absolute datetime for case completion
   * MANDATORY field - used for global worklist prioritization and SLA tracking
   * Stored as absolute date/time value (not duration)
   */
  slaDueDate: {
    type: Date,
    required: [true, 'SLA Due Date is required'],
  },
  
  /**
   * xID of user who created the case
   * 
   * ✅ CANONICAL IDENTIFIER - MANDATORY ✅
   * 
   * This is the ONLY field that should be used for:
   * - Case ownership logic
   * - Authorization checks
   * - Creator identification
   * - Audit trails
   * 
   * MANDATORY field - derived from auth context (req.user.xID)
   * Format: X123456
   * Immutable after creation
   * 
   * NEVER infer this from email - it must come from authenticated user context.
   */
  createdByXID: {
    type: String,
    required: [true, 'Creator xID is required'],
    uppercase: true,
    trim: true,
    immutable: true,
  },
  
  /**
   * Email of user who created the case
   * 
   * ⚠️ DEPRECATED - FOR DISPLAY PURPOSES ONLY ⚠️
   * 
   * NEVER use this field for:
   * - Ownership logic
   * - Authorization checks
   * - Case queries
   * - Assignment operations
   * 
   * ALWAYS use createdByXID instead for all ownership and authorization logic.
   * This field is kept only for backward compatibility and display purposes.
   * 
   * Email must never be used as an ownership or attribution identifier.
   */
  createdBy: {
    type: String,
    lowercase: true,
    trim: true,
  },
  
  /**
   * xID of currently assigned user
   * 
   * ✅ CANONICAL IDENTIFIER - REQUIRED FOR ASSIGNMENT ✅
   * 
   * This is the ONLY field that should be used for:
   * - Case assignment operations
   * - Ownership queries
   * - Authorization checks
   * - Worklist filtering
   * 
   * CANONICAL IDENTIFIER: Stores user's xID (e.g., X123456), NOT email
   * Null when unassigned, tracks current ownership
   * 
   * PR #42: Standardized to use xID as the canonical identifier
   * PR #44: Enforced with guardrails - email-based assignment is blocked
   * PR: xID Canonicalization - Renamed to assignedToXID, assignedTo deprecated
   * 
   * - Assignment operations MUST store xID
   * - Query operations MUST filter by xID
   * - Display operations MUST resolve xID → user info
   * 
   * NEVER use email for assignment or ownership logic.
   */
  assignedToXID: {
    type: String,
    uppercase: true,
    trim: true,
  },
  
  /**
   * ⚠️ DEPRECATED - DO NOT USE ⚠️
   * 
   * Legacy field kept for backward compatibility during migration.
   * Use assignedToXID instead for all ownership operations.
   * 
   * This field will be removed in a future release.
   */
  assignedTo: {
    type: String,
    uppercase: true,
    trim: true,
  },
  
  /**
   * Timestamp when case was assigned to current user
   * Tracks when case was pulled from global worklist or assigned
   */
  assignedAt: {
    type: Date,
  },
  
  /**
   * Queue Type - CANONICAL field for case visibility
   * 
   * Determines which worklist the case appears in:
   * - GLOBAL: Case is in the global worklist (unassigned cases)
   * - PERSONAL: Case is in someone's personal worklist (assigned cases)
   * 
   * This field is critical for the worklist/dashboard mismatch fix.
   * 
   * Rules:
   * - New cases start as GLOBAL (with status UNASSIGNED)
   * - Pulling a case sets queueType = PERSONAL and assigns to user
   * - Filing a case removes it from all worklists
   * 
   * PR: Fix Dashboard/Worklist Mismatch
   */
  queueType: {
    type: String,
    enum: {
      values: ['GLOBAL', 'PERSONAL'],
      message: '{VALUE} is not a valid queue type',
    },
    default: 'GLOBAL',
  },
  
  /**
   * xID of user who pended this case
   * 
   * ✅ CANONICAL IDENTIFIER - MANDATORY FOR PENDED CASES ✅
   * 
   * Tracks who put the case into PENDED status.
   * Used for:
   * - "My Pending Cases" dashboard queries
   * - Audit trail for pending actions
   * - Auto-reopen attribution
   * 
   * Format: X123456
   * Must be set when status changes to PENDED
   * 
   * PR: Case Lifecycle & Dashboard Logic
   */
  pendedByXID: {
    type: String,
    uppercase: true,
    trim: true,
  },
  
  /**
   * xID of user who performed the last action
   * 
   * ✅ CANONICAL IDENTIFIER - AUDIT TRAIL ✅
   * 
   * Tracks the last person who modified the case status.
   * Used for:
   * - Audit logs
   * - Case timeline
   * - Attribution of all case actions
   * 
   * Format: X123456
   * Updated on every status change action
   * 
   * PR: Case Lifecycle & Dashboard Logic
   */
  lastActionByXID: {
    type: String,
    uppercase: true,
    trim: true,
  },
  
  /**
   * Timestamp of last case action
   * 
   * Tracks when the last action was performed on the case.
   * Used for:
   * - Case timeline
   * - Audit trail
   * - Sorting by recent activity
   * 
   * Updated on every status change action
   * 
   * PR: Case Lifecycle & Dashboard Logic
   */
  lastActionAt: {
    type: Date,
  },
  
  /**
   * Case locking mechanism for concurrency control
   * Prevents multiple users from modifying the same case simultaneously
   * Includes inactivity tracking for auto-unlock after 2 hours
   */
  lockStatus: {
    isLocked: {
      type: Boolean,
      default: false,
    },
    activeUserEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    lockedAt: {
      type: Date,
    },
    lastActivityAt: {
      type: Date,
    },
  },
  
  /**
   * Client ID - MANDATORY
   * References a client by their immutable clientId (C123456 format)
   * EVERY case MUST have a client - either a real client or the organization client
   * 
   * Format: String clientId (e.g., "C123456", "C654321")
   * NOT an ObjectId reference - uses immutable client identifier
   */
  clientId: {
    type: String,
    required: [true, 'Client ID is required - every case must have a client'],
    trim: true,
  },
  
  /**
   * Snapshot of client data at case creation
   * Stores immutable client information for audit trail
   * Even if client data changes later, this preserves the original state
   * Automatically populated via pre-save hook when clientId is provided
   */
  clientSnapshot: {
    clientId: String,           // C123456 format
    businessName: String,        // Client name at time of case creation
    primaryContactNumber: String, // Primary contact at time of case creation
    businessEmail: String,
    businessAddress: String,
    PAN: String,
    GST: String,
    CIN: String,
  },
  
  /**
   * Payload for client governance cases
   * Stores proposed client changes that will be applied upon approval
   * Used for Client - New, Client - Edit, Client - Delete cases
   * 
   * Structure for "Client - New":
   * {
   *   action: "NEW",
   *   clientData: { businessName: "...", businessAddress: "...", ... }
   * }
   * 
   * Structure for "Client - Edit":
   * {
   *   action: "EDIT",
   *   clientId: "C123457",
   *   updates: { primaryContactNumber: "...", businessEmail: "...", ... }
   * }
   * 
   * Structure for "Client - Delete":
   * {
   *   action: "DELETE",
   *   clientId: "C123457"
   * }
   */
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  
  /**
   * Workflow metadata - submission tracking
   */
  submittedAt: {
    type: Date,
  },
  
  submittedBy: {
    type: String,
    lowercase: true,
    trim: true,
  },
  
  /**
   * Workflow metadata - approval tracking
   */
  approvedAt: {
    type: Date,
  },
  
  approvedBy: {
    type: String,
    lowercase: true,
    trim: true,
  },
  
  /**
   * Admin decision comments for approval/rejection
   */
  decisionComments: {
    type: String,
    trim: true,
  },
  
  /**
   * Google Drive folder structure for CFS (Case File System)
   * 
   * Stores the Google Drive folder IDs for this case's file structure.
   * Created automatically during case creation via pre-save hook.
   * 
   * Structure:
   * - firmRootFolderId: firm_<firmId> folder
   * - cfsRootFolderId: cfs_<caseId> folder
   * - attachmentsFolderId: attachments/ subfolder
   * - documentsFolderId: documents/ subfolder
   * - evidenceFolderId: evidence/ subfolder
   * - internalFolderId: internal/ subfolder
   * 
   * Security:
   * - Folder IDs are authoritative for file access
   * - Never rely on folder names for authorization
   * - All file operations must use these IDs
   */
  drive: {
    firmRootFolderId: {
      type: String,
      trim: true,
    },
    cfsRootFolderId: {
      type: String,
      trim: true,
    },
    attachmentsFolderId: {
      type: String,
      trim: true,
    },
    documentsFolderId: {
      type: String,
      trim: true,
    },
    evidenceFolderId: {
      type: String,
      trim: true,
    },
    internalFolderId: {
      type: String,
      trim: true,
    },
  },
}, {
  // Automatic timestamp management for audit trail
  timestamps: true,
});

/**
 * Custom Validator: Pending/PENDED status requires pendingUntil date
 * Ensures cases in Pending/PENDED status have a review date set
 * 
 * PR: Updated to support both legacy 'Pending' and new 'PENDED' status
 */
caseSchema.path('status').validate(function(value) {
  if ((value === 'Pending' || value === 'PENDED') && !this.pendingUntil) {
    return false;
  }
  return true;
}, 'pendingUntil date is required when status is Pending or PENDED');

/**
 * Virtual Property: isReadOnly
 * Returns true if case is in a finalized state (Closed, Filed, or FILED)
 * Used by UI/API to prevent modifications to finalized cases
 * 
 * PR: Updated to support new FILED status
 */
caseSchema.virtual('isReadOnly').get(function() {
  return this.status === 'Closed' || this.status === 'Filed' || this.status === 'FILED';
});

/**
 * Pre-save Hook: Auto-generate case identifiers
 * 
 * PR: Case Identifier Semantics - Updated to generate both internal and display IDs
 * 
 * Generates:
 * 1. caseInternalId: Opaque ObjectId for internal use (auto-generated by schema default)
 * 2. caseNumber: Human-readable CASE-YYYYMMDD-XXXXX for display
 * 3. caseName: Legacy caseYYYYMMDDxxxxx format for backward compatibility
 * 4. caseId: Deprecated field populated with caseNumber value for transition period
 * 
 * PR 2: Atomic Counter Implementation
 * - Uses MongoDB atomic counters to eliminate race conditions
 * - Firm-scoped counters for multi-tenancy
 * - Daily sequence reset (counter name includes date)
 * 
 * Algorithm for caseNumber:
 * 1. Get current date (YYYYMMDD)
 * 2. Atomically increment firm-scoped counter for today
 * 3. Format as CASE- + YYYYMMDD + - + 5-digit zero-padded sequence
 * 
 * Algorithm for caseName:
 * 1. Get current date (YYYYMMDD)
 * 2. Atomically increment firm-scoped counter for today
 * 3. Format as case + YYYYMMDD + 5-digit zero-padded sequence
 * 
 * Note: This runs before validation, so IDs are available for unique constraint check
 * 
 * CONCURRENCY-SAFE: Uses atomic counters to prevent race conditions
 */
caseSchema.pre('validate', async function() {
  // Ensure firmId is set before generating IDs
  // This is fail-fast validation at the model level (checks existence)
  // counter.service.js performs defensive validation (checks type and existence)
  if (!this.firmId) {
    throw new Error('Firm ID is required for case creation');
  }
  
  // caseInternalId is auto-generated by schema default (ObjectId)
  // No explicit generation needed here
  
  // Only generate case number if not already set (for new documents)
  if (!this.caseNumber) {
    const { generateCaseId } = require('../services/caseIdGenerator');
    this.caseNumber = await generateCaseId(this.firmId);
  }
  
  // Generate caseName if not set
  if (!this.caseName) {
    const { generateCaseName } = require('../services/caseNameGenerator');
    this.caseName = await generateCaseName(this.firmId);
  }
  
  // Populate deprecated caseId field with caseNumber for backward compatibility
  if (!this.caseId && this.caseNumber) {
    this.caseId = this.caseNumber;
  }
  
  // If this is a new case and clientId is provided, fetch and snapshot the client
  // This preserves client data at the time of case creation for audit trail
  if (this.isNew && this.clientId && !this.clientSnapshot) {
    const Client = mongoose.model('Client');
    const client = await Client.findOne({ clientId: this.clientId }).lean();
    if (client) {
      this.clientSnapshot = {
        clientId: client.clientId,
        businessName: client.businessName,
        primaryContactNumber: client.primaryContactNumber,
        businessEmail: client.businessEmail,
        businessAddress: client.businessAddress,
        PAN: client.PAN,
        GST: client.GST,
        CIN: client.CIN,
      };
    }
  }
  
  // Create Google Drive CFS folder structure for new cases
  // This must happen after case identifiers are generated
  if (this.isNew && !this.drive?.cfsRootFolderId) {
    const cfsDriveService = require('../services/cfsDrive.service');
    const folderIds = await cfsDriveService.createCFSFolderStructure(
      this.firmId,
      this.caseNumber // Use human-readable case number for folder name
    );
    
    // Persist folder IDs in the case document
    this.drive = folderIds;
    
    console.log(`[Case] Created CFS folder structure for case ${this.caseNumber}`);
  }
});

/**
 * Performance Indexes
 * 
 * CRITICAL: Internal ID and firm-scoped unique indexes
 * - caseInternalId: Primary internal lookup index (unique across all firms)
 * - (firmId, caseInternalId): Firm-scoped internal ID lookup
 * - (firmId, caseNumber): Case numbers reset per firm (display only)
 * - (firmId, caseName): Case names reset per firm (display only)
 * - (firmId, caseId): DEPRECATED - backward compatibility during transition
 * 
 * Other indexes:
 * - status + priority: Common filter combination for listing cases
 * - category: Access control and filtering by case type
 * - createdBy: DEPRECATED - kept for backward compatibility only
 * - createdByXID: CANONICAL - find cases created by specific user (xID)
 * - assignedToXID: CANONICAL - find cases assigned to specific user (xID)
 * - assignedTo: DEPRECATED - kept for backward compatibility during migration
 * - clientId: Find cases associated with a specific client
 * - Additional indexes for global search and worklists:
 *   - status: Filter by status for worklists
 *   - createdAt: Sort by creation date
 *   - assignedToXID + status: Employee worklist queries (xID-based)
 *   - queueType + status: Queue-based worklist queries (GLOBAL vs PERSONAL)
 *   - pendedByXID + status: Pending cases dashboard queries (xID-based)
 *   - pendingUntil: Auto-reopen scheduler queries
 * 
 * PR #44: Added createdByXID index for xID-based ownership queries
 * PR: Case Lifecycle - Added queueType, pendedByXID, pendingUntil indexes
 * PR: xID Canonicalization - Migrated from assignedTo to assignedToXID
 * PR: Firm-Scoped Identity - Added firm-scoped unique indexes
 * PR: Case Identifier Semantics - Added caseInternalId indexes, made caseNumber display-only
 * Note: Email-based ownership queries are not supported
 */
// CRITICAL: Internal ID indexes for true database lookups
caseSchema.index({ caseInternalId: 1 }, { unique: true });
caseSchema.index({ firmId: 1, caseInternalId: 1 });

// MANDATORY: Firm-scoped unique indexes for display identifiers
caseSchema.index({ firmId: 1, caseNumber: 1 }, { unique: true });
caseSchema.index({ firmId: 1, caseName: 1 }, { unique: true });

// DEPRECATED: Backward compatibility - will be removed after transition
caseSchema.index({ firmId: 1, caseId: 1 }, { sparse: true });

caseSchema.index({ status: 1, priority: 1 });
caseSchema.index({ category: 1 });
caseSchema.index({ createdBy: 1 }); // DEPRECATED - kept for backward compatibility
caseSchema.index({ createdByXID: 1 }); // CANONICAL - xID-based creator queries
caseSchema.index({ assignedToXID: 1 }); // CANONICAL - xID-based assignment queries
caseSchema.index({ assignedTo: 1 }); // DEPRECATED - kept for migration
caseSchema.index({ clientId: 1 });
caseSchema.index({ status: 1 });
caseSchema.index({ createdAt: -1 });
caseSchema.index({ assignedToXID: 1, status: 1 }); // CANONICAL - xID-based worklist queries
caseSchema.index({ queueType: 1, status: 1 }); // Queue-based worklist queries
caseSchema.index({ pendedByXID: 1, status: 1 }); // Pending cases dashboard queries
caseSchema.index({ pendingUntil: 1 }); // Auto-reopen scheduler queries
// REMOVED: { firmId: 1 } - redundant with compound indexes above (firmId, caseInternalId), (firmId, caseNumber), etc.
caseSchema.index({ firmId: 1, status: 1 }); // Firm-scoped status queries
caseSchema.index({ firmId: 1, assignedToXID: 1 }); // Firm-scoped assignment queries

module.exports = mongoose.model('Case', caseSchema);
