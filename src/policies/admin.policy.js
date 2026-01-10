/**
 * Admin Authorization Policies
 * 
 * Centralized authorization logic for admin-only operations.
 * These policies define who can perform admin-level actions.
 * 
 * Rules:
 * - Only Admin role can access admin operations
 * - SuperAdmin cannot access firm admin operations
 * - Employee cannot access admin operations
 */

/**
 * Check if user has admin access
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const isAdmin = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm admin operations
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin role has admin access
  return user.role === 'Admin';
};

/**
 * Check if user can view admin statistics
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canViewStats = (user) => {
  return isAdmin(user);
};

/**
 * Check if user can manage users (create, update, invite)
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canManageUsers = (user) => {
  return isAdmin(user);
};

/**
 * Check if user can view all cases (admin visibility)
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canViewAllCases = (user) => {
  return isAdmin(user);
};

/**
 * Check if user can manage categories
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canManageCategories = (user) => {
  return isAdmin(user);
};

module.exports = {
  isAdmin,
  canViewStats,
  canManageUsers,
  canViewAllCases,
  canManageCategories,
};
