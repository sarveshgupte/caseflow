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
 */
const CASE_STATUS = {
  // New workflow states
  UNASSIGNED: 'UNASSIGNED',
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CLOSED: 'CLOSED',
  
  // Legacy states (for backward compatibility)
  OPEN: 'Open',
  REVIEWED: 'Reviewed',
  PENDING: 'Pending',
  FILED: 'Filed',
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
