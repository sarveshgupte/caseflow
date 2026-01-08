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
   * Optional field - cases are now primarily identified by caseCategory
   */
  title: {
    type: String,
    trim: true,
  },
  
  /**
   * Detailed information about the case
   * Optional to allow quick case creation
   */
  description: {
    type: String,
    trim: true,
  },
  
  /**
   * Classification for access control and organization
   * Used to determine which users can access this case
   */
  category: {
    type: String,
    required: [true, 'Case category is required'],
    trim: true,
  },
  
  /**
   * Primary case category - drives all workflows
   * MANDATORY field that determines case processing
   * Examples: 'Client - New', 'Client - Edit', 'Client - Delete', 'Sales', etc.
   */
  caseCategory: {
    type: String,
    required: [true, 'Case category is required'],
    trim: true,
  },
  
  /**
   * Optional sub-category for additional classification
   * Provides finer-grained categorization without UI complexity
   */
  caseSubCategory: {
    type: String,
    trim: true,
  },
  
  /**
   * Current lifecycle status of the case
   * Workflow states:
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
      values: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED', 'Open', 'Reviewed', 'Pending', 'Filed', 'Archived'],
      message: '{VALUE} is not a valid status',
    },
    default: 'DRAFT',
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
   * Email of user who created the case
   * Required for accountability and audit trail
   * Stored as email (lowercase) rather than ObjectId for simplicity
   */
  createdBy: {
    type: String,
    required: [true, 'Creator email is required'],
    lowercase: true,
    trim: true,
  },
  
  /**
   * Email of currently assigned user
   * Null when unassigned, tracks current ownership
   */
  assignedTo: {
    type: String,
    lowercase: true,
    trim: true,
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
    businessPhone: String,
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
   *   updates: { businessPhone: "...", ... }
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
caseSchema.pre('save', async function(next) {
  // Only generate IDs if they're not already set (for new documents)
  if (!this.caseId) {
    try {
      const { generateCaseId } = require('../services/caseIdGenerator');
      this.caseId = await generateCaseId();
    } catch (error) {
      return next(error);
    }
  }
  
  // Generate caseName if not set
  if (!this.caseName) {
    try {
      const { generateCaseName } = require('../services/caseNameGenerator');
      this.caseName = await generateCaseName();
    } catch (error) {
      return next(error);
    }
  }
  
  // If this is a new case and clientId is provided, fetch and snapshot the client
  // This preserves client data at the time of case creation for audit trail
  if (this.isNew && this.clientId && !this.clientSnapshot) {
    try {
      const Client = mongoose.model('Client');
      const client = await Client.findOne({ clientId: this.clientId }).lean();
      if (client) {
        this.clientSnapshot = {
          clientId: client.clientId,
          businessName: client.businessName,
          businessPhone: client.businessPhone,
          businessEmail: client.businessEmail,
          businessAddress: client.businessAddress,
          PAN: client.PAN,
          GST: client.GST,
          CIN: client.CIN,
        };
      }
    } catch (error) {
      return next(error);
    }
  }
  
  next();
});

/**
 * Performance Indexes
 * 
 * - caseId: Unique index (automatic from schema definition with unique: true)
 * - caseName: Unique index (automatic from schema definition with unique: true)
 * - status + priority: Common filter combination for listing cases
 * - category: Access control and filtering by case type
 * - createdBy: Find cases created by specific user
 * - assignedTo: Find cases assigned to specific user
 * - clientId: Find cases associated with a specific client
 * - Additional indexes for global search and worklists:
 *   - status: Filter by status for worklists
 *   - createdAt: Sort by creation date
 *   - assignedTo + status: Employee worklist queries
 */
caseSchema.index({ status: 1, priority: 1 });
caseSchema.index({ category: 1 });
caseSchema.index({ createdBy: 1 });
caseSchema.index({ assignedTo: 1 });
caseSchema.index({ clientId: 1 });
caseSchema.index({ status: 1 });
caseSchema.index({ createdAt: -1 });
caseSchema.index({ assignedTo: 1, status: 1 });

module.exports = mongoose.model('Case', caseSchema);
