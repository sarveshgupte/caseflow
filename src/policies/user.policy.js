/**
 * User Authorization Policies
 * 
 * Centralized authorization logic for user management operations.
 * These policies define who can perform what actions on users.
 * 
 * Rules:
 * - Admin can view, create, update, and delete users within their firm
 * - Employee can view users (for assignment purposes)
 * - SuperAdmin cannot access firm users
 */

/**
 * Check if user can view users
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canView = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Admin and Employee can view users (for assignment purposes)
  return ['Admin', 'Employee'].includes(user.role);
};

/**
 * Check if user can create users
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canCreate = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can create users
  return user.role === 'Admin';
};

/**
 * Check if user can update users
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canUpdate = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can update users
  return user.role === 'Admin';
};

/**
 * Check if user can delete users
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canDelete = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can delete users
  return user.role === 'Admin';
};

/**
 * Check if user can manage user permissions (restrict clients, etc.)
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canManagePermissions = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can manage user permissions
  return user.role === 'Admin';
};

module.exports = {
  canView,
  canCreate,
  canUpdate,
  canDelete,
  canManagePermissions,
};
