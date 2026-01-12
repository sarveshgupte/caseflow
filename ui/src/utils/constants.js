/**
 * Application Constants
 */

export const APP_NAME = 'Docketra';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const CASE_STATUS = {
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
  
  // Legacy statuses for backward compatibility (do NOT use for new code)
  OPEN_LEGACY: 'Open',
  REVIEWED: 'Reviewed',
  PENDING: 'Pending',
  PENDING_LEGACY: 'Pending',
  FILED_LEGACY: 'Filed',
  ARCHIVED: 'Archived',
};

export const CASE_CATEGORIES = {
  CLIENT_NEW: 'Client - New',
  CLIENT_EDIT: 'Client - Edit',
  CLIENT_DELETE: 'Client - Delete',
  SALES: 'Sales',
  ACCOUNTING: 'Accounting',
  EXPENSES: 'Expenses',
  PAYROLL: 'Payroll',
  HR: 'HR',
  COMPLIANCE: 'Compliance',
  CORE_BUSINESS: 'Core Business',
  MANAGEMENT_REVIEW: 'Management Review',
  INTERNAL: 'Internal',
  OTHER: 'Other',
};

export const DEFAULT_CLIENT_ID = 'C000001';

export const CLIENT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
};

export const USER_ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  ADMIN: 'Admin',
  EMPLOYEE: 'Employee',
};

export const STORAGE_KEYS = {
  X_ID: 'xID',
  USER: 'user',
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
};

/**
 * Error codes returned by backend API
 * Used to identify specific error conditions and handle them appropriately in the UI
 */
export const ERROR_CODES = {
  /** User must set initial password via email link before they can login */
  PASSWORD_SETUP_REQUIRED: 'PASSWORD_SETUP_REQUIRED',
};

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};
