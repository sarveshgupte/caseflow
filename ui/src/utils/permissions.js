/**
 * Permission Utilities
 */

import { USER_ROLES } from './constants';

export const isAdmin = (user) => {
  return user?.role === USER_ROLES.ADMIN;
};

export const isEmployee = (user) => {
  return user?.role === USER_ROLES.EMPLOYEE;
};

export const canEditCase = (user, caseData) => {
  // Check if user has permission to edit case
  if (isAdmin(user)) return true;
  
  // Check if case is assigned to user
  if (caseData?.assignedTo === user?.xID) return true;
  
  return false;
};

export const canApproveCase = (user) => {
  return isAdmin(user);
};

export const canUnpendCase = (user) => {
  return isAdmin(user);
};

export const canManageUsers = (user) => {
  return isAdmin(user);
};

export const canViewCategoryWorklist = (user, categoryId) => {
  // For now, all authenticated users can view worklists
  // Backend will enforce actual permission checks
  return true;
};

export const canAddComment = (user, caseData) => {
  // All authenticated users can add comments
  return true;
};

export const canAddAttachment = (user, caseData) => {
  // All authenticated users can add attachments
  return true;
};

export const canUpdateStatus = (user, caseData) => {
  // Check if user can update case status
  if (isAdmin(user)) return true;
  
  // Check if case is assigned to user
  if (caseData?.assignedTo === user?.xID) return true;
  
  return false;
};

export const canCloneCase = (user) => {
  // All authenticated users can clone cases
  return true;
};
