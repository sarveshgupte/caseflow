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
  // Format: X followed by 6 digits (e.g., X000001, X000002)
  // IMMUTABLE - Cannot be changed after creation
  // FIRM-SCOPED - Each firm starts with X000001
  xID: {
    type: String,
    required: [true, 'xID is required'],
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
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
  },
  
  // Firm/Organization ID for multi-tenancy
  // All users belong to a firm - enforces data isolation
  // IMMUTABLE - Users cannot change firms
  // NOTE: SUPER_ADMIN role has null firmId (platform-level access)
  firmId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Firm',
    required: function() {
      // firmId is required for Admin and Employee, but not for SUPER_ADMIN
      return this.role !== 'SUPER_ADMIN';
    },
    immutable: true,
  },
  
  /**
   * Default Client ID for multi-tenancy
   * 
   * PR-2: Bootstrap Atomicity & Identity Decoupling
   * - OPTIONAL during firm bootstrap (allows admin creation before default client)
   * - Can be null temporarily during firm onboarding
   * - Must be set before admin can login (enforced in auth flow)
   * - SUPER_ADMIN always has null defaultClientId (platform-level access)
   * 
   * For Admins, this should eventually point to the Firm's default client
   * For Employees, this points to their assigned default client
   */
  defaultClientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client',
    required: false, // Made optional to support atomic firm bootstrap
    default: null,
    immutable: true, // Cannot change default client after creation
    index: true,
  },
  
  // Determines access level: SUPER_ADMIN manages platform, Admin has full firm access, Employee has category-restricted access
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'Admin', 'Employee'],
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

  /**
   * Authentication providers
   * LOCAL: password-based auth (authoritative for SuperAdmin and platform users)
   * GOOGLE: OAuth-based auth (invite-only, DB-backed users only)
   */
  authProviders: {
    local: {
      passwordHash: { type: String, default: null },
      passwordSet: { type: Boolean, default: false },
    },
    google: {
      googleId: { type: String, default: null },
      linkedAt: { type: Date, default: null },
    }
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
  
  // Secure token hash for password setup / invite (stored as hash, never plain text)
  // Also serves as invite token for new user onboarding
  passwordSetupTokenHash: {
    type: String,
    default: null,
  },
  
  // Alias for invite token (points to same field as passwordSetupTokenHash)
  inviteTokenHash: {
    type: String,
    default: null,
    get: function() { return this.passwordSetupTokenHash; },
    set: function(value) { this.passwordSetupTokenHash = value; },
  },
  
  // Expiry timestamp for password setup / invite token (e.g., 48 hours from creation)
  passwordSetupExpires: {
    type: Date,
    default: null,
  },
  
  // Alias for invite token expiry (points to same field as passwordSetupExpires)
  inviteTokenExpiry: {
    type: Date,
    default: null,
    get: function() { return this.passwordSetupExpires; },
    set: function(value) { this.passwordSetupExpires = value; },
  },
  
  // Timestamp of last password change
  passwordLastChangedAt: {
    type: Date,
    default: Date.now,
  },
  
  // Password expires 60 days after last change
  // Not required for invited users who haven't set password yet
  passwordExpiresAt: {
    type: Date,
    required: false,
    default: null,
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
  
  // Flag to trigger password reset flow on successful login (for first login scenario)
  // When true, user can login but will be prompted to reset password via email
  forcePasswordReset: {
    type: Boolean,
    default: false,
  },
  
  // Token hash for password reset (for first login flow)
  passwordResetTokenHash: {
    type: String,
    default: null,
  },
  
  // Expiry timestamp for password reset token
  passwordResetExpires: {
    type: Date,
    default: null,
  },
  
  // Manager reference for hierarchical reporting structure (nullable)
  // Supports organizational hierarchy - employees can have a manager
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  
  /**
   * Client approval permission flag
   * When true, this user can approve client cases regardless of hierarchy
   * Top-most admins (managerId = null) OR users with canApproveClients = true can approve
   */
  canApproveClients: {
    type: Boolean,
    default: false,
  },
  
  /**
   * User account status for lifecycle management
   * INVITED - User created by admin, hasn't set password yet
   * ACTIVE - User has set password and can login
   * DISABLED - User account disabled by admin
   */
  status: {
    type: String,
    enum: ['INVITED', 'ACTIVE', 'DISABLED'],
    default: 'INVITED',
    required: true,
  },
  
  /**
   * Timestamp when invite email was last sent
   * PR #48: Track when admin resends invite emails
   */
  inviteSentAt: {
    type: Date,
    default: null,
  },
  
  /**
   * System user flag - marks users created during firm onboarding
   * TRUE for the default admin user (X000001) created when a firm is onboarded
   * System users (isSystem=true) CANNOT be deleted or deactivated
   * This ensures firms always have at least one active admin
   */
  isSystem: {
    type: Boolean,
    default: false,
    immutable: true, // Cannot change after creation
    index: true,
  },
  
  /**
   * Client Access Restrictions (Admin-Managed Deny-List)
   * Array of client IDs (C123456 format) that this user CANNOT access
   * Default: empty array (user can access all clients)
   * Admin-only: Only admins can modify this field
   * 
   * Enforcement:
   * - Blocks case creation with restricted clients
   * - Filters restricted clients from case lists
   * - Prevents deep link access to restricted client cases
   * - Fully audited changes
   */
  restrictedClientIds: {
    type: [String],
    default: [],
    validate: {
      validator: function(arr) {
        return arr.every(id => /^C\d{6}$/.test(id));
      },
      message: 'All client IDs must be in format C123456',
    },
  },
  
  // Audit trail for user account creation
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  // Enable virtuals in JSON output
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true },
});

/**
 * Validation: Admin defaultClientId must match Firm's defaultClientId
 * Ensures the hierarchy is correct: Firm → Default Client → Admin
 */
userSchema.pre('save', async function() {
  // Only validate for Admin role with both firmId and defaultClientId
  if (this.role === 'Admin' && this.firmId && this.defaultClientId) {
    try {
      const Firm = require('./Firm.model');
      const firm = await Firm.findById(this.firmId);
      
      if (firm && firm.defaultClientId) {
        // Admin's defaultClientId must match Firm's defaultClientId
        if (firm.defaultClientId.toString() !== this.defaultClientId.toString()) {
          const error = new Error('Admin user\'s defaultClientId must match the Firm\'s defaultClientId');
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
      console.warn('[User Validation] Could not verify Admin defaultClientId constraint:', error.message);
    }
  }
  
  // GUARDRAIL: Prevent saving Admin users without defaultClientId
  // Exception: Allow during firm bootstrap (when isNew and defaultClientId will be set in transaction)
  // This prevents accidental creation of admins without proper scoping
  if (this.role === 'Admin' && !this.isNew && !this.defaultClientId) {
    const error = new Error(
      'Cannot save Admin user without defaultClientId. ' +
      'Admin users must be scoped to their firm\'s default client. ' +
       'Firm hierarchy requires: Firm → Default Client → Admins'
    );
    error.name = 'ValidationError';
    throw error;
  }

  // Keep authProviders.local in sync with legacy password fields
  if (!this.authProviders) {
    this.authProviders = { local: {}, google: {} };
  }
  if (!this.authProviders.local) {
    this.authProviders.local = {};
  }
  if (this.isModified('passwordHash')) {
    this.authProviders.local.passwordHash = this.passwordHash;
  }
  if (this.isModified('passwordSet')) {
    this.authProviders.local.passwordSet = this.passwordSet;
  }
});

// Indexes for performance
// CRITICAL: Firm-scoped unique index on (firmId, xID)
// - Each firm has its own X000001, X000002, etc.
// - xID is unique WITHIN a firm, not globally
// - Email remains globally unique for login purposes
userSchema.index({ firmId: 1, xID: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true }); // Email is globally unique
userSchema.index({ isActive: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
// REMOVED: { firmId: 1 } - redundant with compound index (firmId, xID) above
userSchema.index({ firmId: 1, role: 1 }); // Firm-scoped role queries
userSchema.index({ 'authProviders.google.googleId': 1 }, { unique: true, sparse: true }); // One Google account -> one user

// Virtual property to check if account is locked
userSchema.virtual('isLocked').get(function() {
  // Check if lockUntil exists and is in the future
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

module.exports = mongoose.model('User', userSchema);
