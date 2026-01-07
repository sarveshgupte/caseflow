/**
 * usePermissions Hook
 */

import { useAuth } from './useAuth';
import * as permissions from '../utils/permissions';

export const usePermissions = () => {
  const { user } = useAuth();
  
  return {
    isAdmin: permissions.isAdmin(user),
    isEmployee: permissions.isEmployee(user),
    canEditCase: (caseData) => permissions.canEditCase(user, caseData),
    canApproveCase: () => permissions.canApproveCase(user),
    canUnpendCase: () => permissions.canUnpendCase(user),
    canManageUsers: () => permissions.canManageUsers(user),
    canViewCategoryWorklist: (categoryId) => permissions.canViewCategoryWorklist(user, categoryId),
    canAddComment: (caseData) => permissions.canAddComment(user, caseData),
    canAddAttachment: (caseData) => permissions.canAddAttachment(user, caseData),
    canUpdateStatus: (caseData) => permissions.canUpdateStatus(user, caseData),
    canCloneCase: () => permissions.canCloneCase(user),
  };
};
