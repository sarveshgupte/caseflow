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

/**
 * Case History Action Types
 * 
 * PR: Comprehensive CaseHistory & Audit Trail
 * Standardized enum for all case history action types
 */
const CASE_ACTION_TYPES = {
  // Lifecycle Actions
  CASE_CREATED: 'CASE_CREATED',
  CASE_UPDATED: 'CASE_UPDATED',
  CASE_ASSIGNED: 'CASE_ASSIGNED',
  CASE_UNASSIGNED: 'CASE_UNASSIGNED',
  CASE_PENDED: 'CASE_PENDED',
  CASE_UNPENDED: 'CASE_UNPENDED',
  CASE_REOPENED: 'CASE_REOPENED',
  CASE_RESOLVED: 'CASE_RESOLVED',
  CASE_FILED: 'CASE_FILED',
  CASE_MOVED_TO_WORKBASKET: 'CASE_MOVED_TO_WORKBASKET',
  
  // Access & View Actions (NEW - CRITICAL)
  CASE_OPENED: 'CASE_OPENED',
  CASE_VIEWED: 'CASE_VIEWED',
  CASE_EXITED: 'CASE_EXITED',
  
  // Administrative / System Actions
  CASE_VIEWED_BY_ADMIN: 'CASE_VIEWED_BY_ADMIN',
  CASE_ACCESSED_BY_SUPERADMIN: 'CASE_ACCESSED_BY_SUPERADMIN',
  CASE_AUTO_UPDATED: 'CASE_AUTO_UPDATED',
  CASE_AUTO_REOPENED: 'CASE_AUTO_REOPENED',
  CASE_SYSTEM_EVENT: 'CASE_SYSTEM_EVENT',
  
  // Other Actions
  CASE_COMMENT_ADDED: 'CASE_COMMENT_ADDED',
  CASE_FILE_ATTACHED: 'CASE_FILE_ATTACHED',
  CASE_ATTACHMENT_ADDED: 'CASE_ATTACHMENT_ADDED',
  CASE_EDITED: 'CASE_EDITED',
  CASE_STATUS_CHANGED: 'CASE_STATUS_CHANGED',
  CASE_CLOSED_VIEWED: 'CASE_CLOSED_VIEWED',
  
  // List Views
  CASE_LIST_VIEWED: 'CASE_LIST_VIEWED',
  ADMIN_FILED_CASES_VIEWED: 'ADMIN_FILED_CASES_VIEWED',
  ADMIN_APPROVAL_QUEUE_VIEWED: 'ADMIN_APPROVAL_QUEUE_VIEWED',
  ADMIN_RESOLVED_CASES_VIEWED: 'ADMIN_RESOLVED_CASES_VIEWED',
};

/**
 * Client Fact Sheet Action Types
 * 
 * PR: Client Fact Sheet Foundation
 * Audit action types for client fact sheet operations
 */
const CLIENT_FACT_SHEET_ACTION_TYPES = {
  CLIENT_FACT_SHEET_CREATED: 'CLIENT_FACT_SHEET_CREATED',
  CLIENT_FACT_SHEET_UPDATED: 'CLIENT_FACT_SHEET_UPDATED',
  CLIENT_FACT_SHEET_FILE_ADDED: 'CLIENT_FACT_SHEET_FILE_ADDED',
  CLIENT_FACT_SHEET_FILE_REMOVED: 'CLIENT_FACT_SHEET_FILE_REMOVED',
  CLIENT_FACT_SHEET_VIEWED: 'CLIENT_FACT_SHEET_VIEWED',
};

module.exports = {
  CASE_LOCK_CONFIG,
  CASE_CATEGORIES,
  CASE_STATUS,
  COMMENT_PREVIEW_LENGTH,
  CLIENT_STATUS,
  CASE_ACTION_TYPES,
  CLIENT_FACT_SHEET_ACTION_TYPES,
};
