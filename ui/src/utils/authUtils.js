import { STORAGE_KEYS, USER_ROLES } from './constants';

// Backend tokens use the SUPERADMIN role constant, so handle both casings.
const SUPERADMIN_ROLE_UPPER = 'SUPERADMIN';
const SUPERADMIN_ROLES = new Set([
  USER_ROLES.SUPER_ADMIN,
  SUPERADMIN_ROLE_UPPER,
]);

export const isSuperAdminRole = (role) => SUPERADMIN_ROLES.has(role);

export const getStoredUser = () => {
  const storedUser = localStorage.getItem(STORAGE_KEYS.USER);
  if (!storedUser) return null;
  try {
    return JSON.parse(storedUser);
  } catch (error) {
    return null;
  }
};

export const isAccessTokenOnlyUser = (user) => {
  if (!user) return false;
  if (user.isSuperAdmin === true) {
    return true;
  }
  if (user.refreshEnabled !== undefined) {
    return user.refreshEnabled === false;
  }
  return isSuperAdminRole(user.role);
};

export const isAccessTokenOnlySession = () => isAccessTokenOnlyUser(getStoredUser());

export const mergeAuthUser = (userData, flags = {}) => {
  if (!userData) return userData;
  const nextUser = { ...userData };
  if (flags.isSuperAdmin !== undefined) {
    nextUser.isSuperAdmin = flags.isSuperAdmin;
  }
  if (flags.refreshEnabled !== undefined) {
    nextUser.refreshEnabled = flags.refreshEnabled;
  }
  return nextUser;
};

export const buildStoredUser = (userData, refreshEnabled) => {
  if (!userData) return userData;
  if (refreshEnabled === undefined) return userData;
  return mergeAuthUser(userData, { refreshEnabled });
};
