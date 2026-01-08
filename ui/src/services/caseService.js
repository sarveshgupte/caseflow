/**
 * Case Service
 */

import api from './api';
import { STORAGE_KEYS } from '../utils/constants';

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
    // Get user from localStorage
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    const user = userStr ? JSON.parse(userStr) : null;
    
    const response = await api.post(`/cases/${caseId}/comments`, {
      text: commentText,
      createdBy: user?.email || 'unknown',
    });
    return response.data;
  },

  /**
   * Add attachment to case
   * PR #41: Fixed to send createdBy as expected by backend
   */
  addAttachment: async (caseId, file, description) => {
    // Get user from localStorage
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    const user = userStr ? JSON.parse(userStr) : null;
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    formData.append('createdBy', user?.email || 'unknown');
    
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
};
