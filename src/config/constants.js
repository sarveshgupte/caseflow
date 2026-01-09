/**
 * Application Configuration Constants
 * 
 * Central location for configuration values used across the application
 */

/**
 * Case locking configuration
 */
const CASE_LOCK_CONFIG = {
  // Auto-unlock after 2 hours of inactivity (in milliseconds)
  INACTIVITY_TIMEOUT_MS: 2 * 60 * 60 * 1000, // 2 hours
  INACTIVITY_TIMEOUT_HOURS: 2,
};

/**
 * Case category constants
 * Use these instead of string literals to avoid typos
 */
const CASE_CATEGORIES = {
  CLIENT_NEW: 'Client - New',
  CLIENT_EDIT: 'Client - Edit',
  CLIENT_DELETE: 'Client - Delete',
};

/**
 * Case workflow status constants
 * New workflow states
 * 
 * PR: Case Lifecycle & Dashboard Logic
 * Added OPEN, PENDED, RESOLVED, FILED as canonical statuses
 */
const CASE_STATUS = {
  // Canonical lifecycle states (NEW - use these)
  UNASSIGNED: 'UNASSIGNED',
  OPEN: 'OPEN',
  PENDED: 'PENDED',
  RESOLVED: 'RESOLVED',
  FILED: 'FILED',
  
  // Workflow states
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED',
  
  // Legacy states (for backward compatibility - do NOT use for new code)
  OPEN_LEGACY: 'Open',
  REVIEWED: 'Reviewed',
  PENDING_LEGACY: 'Pending',
  FILED_LEGACY: 'Filed',
  ARCHIVED: 'Archived',
};

/**
 * Comment preview length for audit logs
 */
const COMMENT_PREVIEW_LENGTH = 50;

/**
 * Client status constants
 * Use these instead of string literals to ensure consistency
 */
const CLIENT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
};

module.exports = {
  CASE_LOCK_CONFIG,
  CASE_CATEGORIES,
  CASE_STATUS,
  COMMENT_PREVIEW_LENGTH,
  CLIENT_STATUS,
};
