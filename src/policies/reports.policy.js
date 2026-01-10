/**
 * Reports Authorization Policies
 * 
 * Centralized authorization logic for reports operations.
 * These policies define who can generate and view reports.
 * 
 * Rules:
 * - Admin and Employee can generate and view reports
 * - SuperAdmin cannot access firm data (reports)
 */

/**
 * Check if user can generate reports
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canGenerate = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Admin and Employee can generate reports
  return ['Admin', 'Employee'].includes(user.role);
};

/**
 * Check if user can view reports
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canView = (user) => {
  if (!user) return false;
  
  // SuperAdmin cannot access firm data
  if (user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN') {
    return false;
  }
  
  // Admin and Employee can view reports
  return ['Admin', 'Employee'].includes(user.role);
};

module.exports = {
  canGenerate,
  canView,
};
