/**
 * Case Authorization Policies
 * 
 * Centralized authorization logic for case operations.
 * These policies define who can perform what actions on cases.
 * 
 * Rules:
 * - Admin and Employee can view, create, and update cases
 * - Only Admin can delete and assign cases
 * - SuperAdmin cannot access firm data (cases)
 */

/**
 * Check if user can view cases
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canView = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Admin and Employee can view cases
  return ['Admin', 'Employee'].includes(user.role);
};

/**
 * Check if user can create cases
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canCreate = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Admin and Employee can create cases
  return ['Admin', 'Employee'].includes(user.role);
};

/**
 * Check if user can update cases
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canUpdate = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Admin and Employee can update cases
  return ['Admin', 'Employee'].includes(user.role);
};

/**
 * Check if user can delete cases
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canDelete = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can delete cases
  return user.role === 'Admin';
};

/**
 * Check if user can assign cases
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canAssign = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can assign cases
  return user.role === 'Admin';
};

/**
 * Check if user can perform case actions (resolve, pend, file)
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canPerformActions = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Admin and Employee can perform case actions
  return ['Admin', 'Employee'].includes(user.role);
};

module.exports = {
  canView,
  canCreate,
  canUpdate,
  canDelete,
  canAssign,
  canPerformActions,
};
