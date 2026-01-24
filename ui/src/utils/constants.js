/**
 * Application Constants
 */

export const APP_NAME = 'Docketra';

/**
 * API Base URL Configuration with Runtime Validation
 * 
 * This app requires VITE_API_BASE_URL to be set in all environments.
 * 
 * ⚠️ DEPLOYMENT REQUIREMENT:
 * Set VITE_API_BASE_URL environment variable in your deployment platform (e.g., Render)
 * 
 * In development:
 * - Set in .env file (e.g., VITE_API_BASE_URL=/api)
 * - The value '/api' is proxied by vite.config.js to localhost:5000
 * 
 * In production:
 * - MUST be explicitly set to your backend API URL
 * - No silent fallbacks - will fail fast with clear error message
 */
const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

// Runtime validation: Fail fast if API base URL is missing or empty
if (!rawApiBaseUrl || rawApiBaseUrl.trim() === '') {
  const errorMessage = `❌ DEPLOYMENT ERROR: VITE_API_BASE_URL environment variable is not defined or empty.

This is a deployment misconfiguration.

ACTION REQUIRED:
1. Set VITE_API_BASE_URL in your deployment platform (e.g., Render)
2. Rebuild and redeploy the application

Example: VITE_API_BASE_URL=https://api.example.com/api`;
  
  // Log to console for debugging
  console.error(errorMessage);
  
  // Throw error to prevent silent failures
  throw new Error('VITE_API_BASE_URL is not defined or empty. Check console for details.');
}

// Log the resolved API base URL for verification (helpful for debugging deployments)
console.info(`✓ Using API base URL: ${rawApiBaseUrl}`);

export const API_BASE_URL = rawApiBaseUrl;

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
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  FIRM_SLUG: 'firmSlug',
  // @deprecated Will be removed in v2.0. Use AuthContext to get user data from API instead.
  X_ID: 'xID',
  // @deprecated Will be removed in v2.0. Use AuthContext to get user data from API instead.
  USER: 'user',
};

export const SESSION_KEYS = {
  GLOBAL_TOAST: 'GLOBAL_TOAST',
};

/**
 * Error codes returned by backend API
 * Used to identify specific error conditions and handle them appropriately in the UI
 */
export const ERROR_CODES = {
  /** User must set initial password via email link before they can login */
  PASSWORD_SETUP_REQUIRED: 'PASSWORD_SETUP_REQUIRED',
  /** Refresh token flow is not supported for this session */
  REFRESH_NOT_SUPPORTED: 'REFRESH_NOT_SUPPORTED',
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
