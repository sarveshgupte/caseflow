/**
 * SuperAdmin Authorization Policies
 * 
 * Centralized authorization logic for SuperAdmin operations.
 * These policies define SuperAdmin-specific access.
 * 
 * Rules:
 * - SuperAdmin has platform-level access only
 * - SuperAdmin CANNOT access firm data (cases, clients, users)
 * - SuperAdmin CAN manage firms and platform operations
 * 
 * EXPLICIT OPT-IN: SuperAdmin access must be explicitly declared
 * Never rely on implicit bypass logic
 */

/**
 * Check if user is SuperAdmin
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if SuperAdmin, false otherwise
 */
const isSuperAdmin = (user) => {
  if (!user) return false;
  
  // Explicit check for SuperAdmin role (both variants)
  return user.role === 'SuperAdmin' || user.role === 'SUPER_ADMIN';
};

/**
 * Check if user can access platform operations
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canAccessPlatform = (user) => {
  return isSuperAdmin(user);
};

/**
 * Check if user can manage firms
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canManageFirms = (user) => {
  return isSuperAdmin(user);
};

/**
 * Check if user can view platform statistics
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if allowed, false otherwise
 */
const canViewPlatformStats = (user) => {
  return isSuperAdmin(user);
};

/**
 * Explicitly deny SuperAdmin access to firm data
 * This policy should be used to protect firm-scoped routes
 * @param {Object} user - Authenticated user from req.user
 * @returns {boolean} - True if NOT SuperAdmin, false if SuperAdmin
 */
const cannotAccessFirmData = (user) => {
  if (!user) return false;
  
  // Deny if SuperAdmin
  return !isSuperAdmin(user);
};

module.exports = {
  isSuperAdmin,
  canAccessPlatform,
  canManageFirms,
  canViewPlatformStats,
  cannotAccessFirmData,
};
