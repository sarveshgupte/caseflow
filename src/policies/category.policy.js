/**
 * Category Authorization Policies
 * 
 * Centralized authorization logic for category management operations.
 * These policies define who can perform what actions on categories.
 * 
 * Rules:
 * - Admin and Employee can view categories
 * - Only Admin can create, update, and delete categories
 * - SuperAdmin cannot access firm data (categories)
 */

/**
 * Check if user can view categories
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canView = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Admin and Employee can view categories
  return ['Admin', 'Employee'].includes(user.role);
};

/**
 * Check if user can create categories
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canCreate = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can create categories
  return user.role === 'Admin';
};

/**
 * Check if user can update categories
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canUpdate = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can update categories
  return user.role === 'Admin';
};

/**
 * Check if user can delete categories
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canDelete = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can delete categories
  return user.role === 'Admin';
};

module.exports = {
  canView,
  canCreate,
  canUpdate,
  canDelete,
};
