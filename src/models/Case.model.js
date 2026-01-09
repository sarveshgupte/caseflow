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
   * Auto-generated deterministic case identifier
   * Format: CASE-YYYYMMDD-XXXXX (e.g., CASE-20260108-00012)
   * Generated via pre-save hook with daily sequence reset
   * MANDATORY - Never editable
   */
  caseId: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    immutable: true,
  },
  
  /**
   * Deterministic case name - PRIMARY external identifier
   * Format: caseYYYYMMDDxxxxx (e.g., case2026010700001)
   * Generated automatically at case creation
   * Unique, immutable, resets daily
   * PART E - Deterministic Case Naming
   */
  caseName: {
    type: String,
    unique: true,
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
   * Workflow states:
   * - UNASSIGNED: Newly created case in global worklist, not yet assigned
   * - DRAFT: Being edited by creator
   * - SUBMITTED: Locked, awaiting review
   * - UNDER_REVIEW: Being reviewed by admin/approver
   * - APPROVED: Changes written to DB (for client cases)
   * - REJECTED: Declined, no DB mutation
   * - CLOSED: Completed and resolved
   * 
   * Legacy states (for backward compatibility):
   * - Open: Active and being worked on
   * - Reviewed: Ready for Admin approval (used for client cases)
   * - Pending: Waiting for external input/decision
   * - Filed: Archived and finalized (read-only)
   * - Archived: Historical record (read-only)
   */
  status: {
    type: String,
    enum: {
      values: ['UNASSIGNED', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED', 'Open', 'Reviewed', 'Pending', 'Filed', 'Archived'],
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
   * 
   * - Assignment operations MUST store xID
   * - Query operations MUST filter by xID
   * - Display operations MUST resolve xID → user info
   * 
   * NEVER use email for assignment or ownership logic.
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
}, {
  // Automatic timestamp management for audit trail
  timestamps: true,
});

/**
 * Custom Validator: Pending status requires pendingUntil date
 * Ensures cases in Pending status have a review date set
 */
caseSchema.path('status').validate(function(value) {
  if (value === 'Pending' && !this.pendingUntil) {
    return false;
  }
  return true;
}, 'pendingUntil date is required when status is Pending');

/**
 * Virtual Property: isReadOnly
 * Returns true if case is in a finalized state (Closed or Filed)
 * Used by UI/API to prevent modifications to finalized cases
 */
caseSchema.virtual('isReadOnly').get(function() {
  return this.status === 'Closed' || this.status === 'Filed';
});

/**
 * Pre-save Hook: Auto-generate caseId and caseName
 * 
 * Generates deterministic case IDs in format CASE-YYYYMMDD-XXXXX
 * Generates deterministic case names in format caseYYYYMMDDxxxxx
 * 
 * Algorithm for caseId:
 * 1. Get current date (YYYYMMDD)
 * 2. Find highest sequence for today
 * 3. Increment by 1
 * 4. Format as CASE- + YYYYMMDD + - + 5-digit zero-padded sequence
 * 
 * Algorithm for caseName:
 * 1. Get current date (YYYYMMDD)
 * 2. Find highest sequence for today
 * 3. Increment by 1
 * 4. Format as case + YYYYMMDD + 5-digit zero-padded sequence
 * 
 * Note: This runs before validation, so IDs are available for unique constraint check
 * 
 * LIMITATION: This implementation has a potential race condition with concurrent saves.
 * For production use with high concurrency, consider using MongoDB's findOneAndUpdate 
 * with atomic increment or a dedicated counter collection.
 */
caseSchema.pre('validate', async function() {
  // Only generate IDs if they're not already set (for new documents)
  if (!this.caseId) {
    const { generateCaseId } = require('../services/caseIdGenerator');
    this.caseId = await generateCaseId();
  }
  
  // Generate caseName if not set
  if (!this.caseName) {
    const { generateCaseName } = require('../services/caseNameGenerator');
    this.caseName = await generateCaseName();
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
});

/**
 * Performance Indexes
 * 
 * - caseId: Unique index (automatic from schema definition with unique: true)
 * - caseName: Unique index (automatic from schema definition with unique: true)
 * - status + priority: Common filter combination for listing cases
 * - category: Access control and filtering by case type
 * - createdBy: DEPRECATED - kept for backward compatibility only
 * - createdByXID: CANONICAL - find cases created by specific user (xID)
 * - assignedTo: CANONICAL - find cases assigned to specific user (xID)
 * - clientId: Find cases associated with a specific client
 * - Additional indexes for global search and worklists:
 *   - status: Filter by status for worklists
 *   - createdAt: Sort by creation date
 *   - assignedTo + status: Employee worklist queries (xID-based)
 * 
 * PR #44: Added createdByXID index for xID-based ownership queries
 * Note: Email-based ownership queries are not supported
 */
caseSchema.index({ status: 1, priority: 1 });
caseSchema.index({ category: 1 });
caseSchema.index({ createdBy: 1 }); // DEPRECATED - kept for backward compatibility
caseSchema.index({ createdByXID: 1 }); // CANONICAL - xID-based creator queries
caseSchema.index({ assignedTo: 1 }); // CANONICAL - xID-based assignment queries
caseSchema.index({ clientId: 1 });
caseSchema.index({ status: 1 });
caseSchema.index({ createdAt: -1 });
caseSchema.index({ assignedTo: 1, status: 1 }); // CANONICAL - xID-based worklist queries

module.exports = mongoose.model('Case', caseSchema);
