/**
 * Application Constants
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export const CASE_STATUS = {
  OPEN: 'Open',
  PENDING: 'Pending',
  CLOSED: 'Closed',
  FILED: 'Filed',
};

export const CASE_CATEGORIES = {
  CLIENT_NEW: 'Client – New',
  CLIENT_EDIT: 'Client – Edit',
  OTHER: 'Other',
};

export const USER_ROLES = {
  ADMIN: 'Admin',
  EMPLOYEE: 'Employee',
};

export const STORAGE_KEYS = {
  X_ID: 'xID',
  USER: 'user',
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
