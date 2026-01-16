import { STORAGE_KEYS, USER_ROLES } from './constants';

const SUPERADMIN_ROLES = new Set(['SUPERADMIN', USER_ROLES.SUPER_ADMIN]);

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
  return user.refreshEnabled === false
    || user.isSuperAdmin === true
    || isSuperAdminRole(user.role);
};

export const isAccessTokenOnlySession = () => isAccessTokenOnlyUser(getStoredUser());

export const buildStoredUser = (userData, refreshEnabled) => {
  if (!userData) return userData;
  if (refreshEnabled === undefined) return userData;
  return { ...userData, refreshEnabled };
};
