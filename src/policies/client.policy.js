/**
 * Client Authorization Policies
 * 
 * Centralized authorization logic for client operations.
 * These policies define who can perform what actions on clients.
 * 
 * Rules:
 * - Admin and Employee can view clients
 * - Only Admin can create, update, and delete clients
 * - SuperAdmin cannot access firm data (clients)
 */

/**
 * Check if user can view clients
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canView = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Admin and Employee can view clients
  return ['Admin', 'Employee'].includes(user.role);
};

/**
 * Check if user can create clients
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canCreate = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can create clients
  return user.role === 'Admin';
};

/**
 * Check if user can update clients
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canUpdate = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can update clients
  return user.role === 'Admin';
};

/**
 * Check if user can delete clients
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canDelete = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can delete (soft delete) clients
  return user.role === 'Admin';
};

/**
 * Check if user can manage client status (enable/disable)
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canManageStatus = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Only Admin can manage client status
  return user.role === 'Admin';
};

module.exports = {
  canView,
  canCreate,
  canUpdate,
  canDelete,
  canManageStatus,
};
