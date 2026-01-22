import { STORAGE_KEYS, USER_ROLES } from './constants';

/**
 * @deprecated User data is no longer stored in localStorage
 * Always returns null. Use AuthContext to get user data from API.
 */
export const getStoredUser = () => {
  return null;
};

/**
 * Determine if a user session should use access-token-only mode (no refresh)
 * This applies to:
 * - SuperAdmin users
 * - Users with refreshEnabled = false
 */
export const isAccessTokenOnlyUser = (user) => {
  if (!user) return false;
  if (user.isSuperAdmin === true) {
    return true;
  }
  if (user.refreshEnabled !== undefined) {
    return user.refreshEnabled === false;
  }
  // Check role as fallback
  if (user.role === USER_ROLES.SUPER_ADMIN || user.role === 'SUPERADMIN') {
    return true;
  }
  return false;
};

/**
 * Check if the current session is access-token-only by checking for refresh token
 */
export const isAccessTokenOnlySession = () => {
  return !localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
};

/**
 * Determines if a user has SuperAdmin privileges.
 * 
 * SuperAdmin users:
 * - Have no firm context (firmSlug is undefined)
 * - Can access all system data across firms
 * - Use a separate routing namespace (/superadmin)
 * 
 * Dual-check rationale:
 * - role check is the canonical source of truth from the backend
 * - isSuperAdmin boolean check provides backward compatibility
 *   with older data structures or API responses
 * 
 * @param {Object} user - User object from AuthContext
 * @returns {boolean} True if user is a SuperAdmin
 */
export const isSuperAdmin = (user) =>
  user?.role === USER_ROLES.SUPER_ADMIN || user?.isSuperAdmin === true;
