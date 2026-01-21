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
