/**
 * Case Service
 */

import api from './api';
import { STORAGE_KEYS } from '../utils/constants';

/**
 * Get authenticated user from localStorage
 * Throws error if not authenticated
 */
const getAuthenticatedUser = () => {
  const userStr = localStorage.getItem(STORAGE_KEYS.USER);
  const user = userStr ? JSON.parse(userStr) : null;
  
  if (!user?.email) {
    throw new Error('User not authenticated. Please log in again.');
  }
  
  return user;
};

export const caseService = {
  /**
   * Get all cases with optional filters
   */
  getCases: async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
    
    const response = await api.get(`/cases?${params.toString()}`);
    return response.data;
  },

  /**
   * Get case by caseId
   */
  getCaseById: async (caseId) => {
    const response = await api.get(`/cases/${caseId}`);
    return response.data;
  },

  /**
   * Create new case
   */
  createCase: async (caseData, forceCreate = false) => {
    const response = await api.post('/cases', {
      ...caseData,
      forceCreate,
    });
    return response.data;
  },

  /**
   * Add comment to case
   * PR #41: Fixed to send text and createdBy as expected by backend
   */
  addComment: async (caseId, commentText) => {
    const user = getAuthenticatedUser();
    
    const response = await api.post(`/cases/${caseId}/comments`, {
      text: commentText,
      createdBy: user.email,
    });
    return response.data;
  },

  /**
   * Add attachment to case
   * PR #41: Fixed to send createdBy as expected by backend
   */
  addAttachment: async (caseId, file, description) => {
    const user = getAuthenticatedUser();
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    formData.append('createdBy', user.email);
    
    const response = await api.post(`/cases/${caseId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Update case status
   */
  updateStatus: async (caseId, status, comment = '') => {
    const response = await api.put(`/cases/${caseId}/status`, {
      status,
      comment,
    });
    return response.data;
  },

  /**
   * Clone case
   */
  cloneCase: async (caseId) => {
    const response = await api.post(`/cases/${caseId}/clone`);
    return response.data;
  },

  /**
   * Unpend case (Admin only)
   */
  unpendCase: async (caseId, comment = '') => {
    const response = await api.post(`/cases/${caseId}/unpend`, {
      comment,
    });
    return response.data;
  },

  /**
   * Lock case
   */
  lockCase: async (caseId) => {
    const response = await api.post(`/cases/${caseId}/lock`);
    return response.data;
  },

  /**
   * Unlock case
   */
  unlockCase: async (caseId) => {
    const response = await api.post(`/cases/${caseId}/unlock`);
    return response.data;
  },

  /**
   * Pull a single case from global worklist
   * Uses the unified pull endpoint with caseIds array
   */
  pullCase: async (caseId) => {
    const response = await api.post('/cases/pull', { caseIds: [caseId] });
    return response.data;
  },

  /**
   * Move case to global worklist (unassign) - Admin only
   */
  moveCaseToGlobal: async (caseId) => {
    const response = await api.post(`/cases/${caseId}/unassign`);
    return response.data;
  },

  /**
   * File a case with mandatory comment
   * Changes status to FILED (read-only, archived)
   */
  fileCase: async (caseId, comment) => {
    const response = await api.post(`/cases/${caseId}/file`, {
      comment,
    });
    return response.data;
  },

  /**
   * Pend a case with mandatory comment and reopen date
   * Changes status to PENDED (temporarily paused)
   */
  pendCase: async (caseId, comment, reopenDate) => {
    const response = await api.post(`/cases/${caseId}/pend`, {
      comment,
      reopenDate,
    });
    return response.data;
  },

  /**
   * Resolve a case with mandatory comment
   * Changes status to RESOLVED (completed)
   */
  resolveCase: async (caseId, comment) => {
    const response = await api.post(`/cases/${caseId}/resolve`, {
      comment,
    });
    return response.data;
  },

  /**
   * Unpend a case with mandatory comment
   * Changes status from PENDED back to OPEN (manual unpend)
   */
  unpendCase: async (caseId, comment) => {
    const response = await api.post(`/cases/${caseId}/unpend`, {
      comment,
    });
    return response.data;
  },

  /**
   * Get my resolved cases
   * Returns cases with status RESOLVED that were resolved by current user
   */
  getMyResolvedCases: async () => {
    const response = await api.get('/cases/my-resolved');
    return response.data;
  },
};
