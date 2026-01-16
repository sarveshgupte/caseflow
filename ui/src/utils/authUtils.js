import { STORAGE_KEYS, USER_ROLES } from './constants';

// Backend tokens may emit SUPERADMIN in uppercase, so normalize for both variants.
const SUPERADMIN_ROLES = new Set([
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.SUPER_ADMIN.toUpperCase(),
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
  if (user.refreshEnabled === false) {
    return true;
  }
  if (user.isSuperAdmin === true) {
    return true;
  }
  if (user.refreshEnabled !== undefined) {
    return false;
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
