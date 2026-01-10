/**
 * Firm Authorization Policies
 * 
 * Centralized authorization logic for firm management operations.
 * These policies define who can perform what actions on firms.
 * 
 * Rules:
 * - Only SuperAdmin can manage firms (create, update, suspend)
 * - Firm users (Admin, Employee) cannot manage firms
 */

/**
 * Check if user can view firms
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canView = (user) => {
  if (!user) return false;
  
  // Only SuperAdmin can view firms list
  return user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN';
};

/**
 * Check if user can create firms
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canCreate = (user) => {
  if (!user) return false;
  
  // Only SuperAdmin can create firms
  return user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN';
};

/**
 * Check if user can update firms
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canUpdate = (user) => {
  if (!user) return false;
  
  // Only SuperAdmin can update firms
  return user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN';
};

/**
 * Check if user can manage firm status (activate/suspend)
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canManageStatus = (user) => {
  if (!user) return false;
  
  // Only SuperAdmin can manage firm status
  return user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN';
};

/**
 * Check if user can create firm admins
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canCreateAdmin = (user) => {
  if (!user) return false;
  
  // Only SuperAdmin can create firm admins
  return user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN';
};

module.exports = {
  canView,
  canCreate,
  canUpdate,
  canManageStatus,
  canCreateAdmin,
};
