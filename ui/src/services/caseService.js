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

  /**
   * Get unassigned cases created by me
   * Returns cases with status UNASSIGNED that were created by current user
   * PR: Fix Case Visibility - New endpoint for dashboard accuracy
   */
  getMyUnassignedCreatedCases: async () => {
    const response = await api.get('/cases/my-unassigned-created');
    return response.data;
  },

  /**
   * View attachment inline
   * Opens attachment in new tab
   */
  viewAttachment: (caseId, attachmentId) => {
    const xID = localStorage.getItem(STORAGE_KEYS.X_ID);
    const apiBaseUrl = window.location.origin;
    const url = `${apiBaseUrl}/api/cases/${caseId}/attachments/${attachmentId}/view?xID=${encodeURIComponent(xID)}`;
    
    // Open in new tab
    window.open(url, '_blank');
  },

  /**
   * Download attachment
   * Forces file download
   */
  downloadAttachment: async (caseId, attachmentId, filename) => {
    const response = await api.get(`/cases/${caseId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  /**
   * Track case opened
   * PR: Comprehensive CaseHistory & Audit Trail
   * Logs when user opens case detail page
   * Fails silently if logging fails
   */
  trackCaseOpen: async (caseId) => {
    try {
      await api.post(`/cases/${caseId}/track-open`);
    } catch (error) {
      // Fail silently - tracking failures should not affect UX
      console.debug('[Tracking] Failed to track case open:', error.message);
    }
  },

  /**
   * Track case viewed
   * PR: Comprehensive CaseHistory & Audit Trail
   * Logs when user actively views case (debounced)
   * Fails silently if logging fails
   */
  trackCaseView: async (caseId) => {
    try {
      await api.post(`/cases/${caseId}/track-view`);
    } catch (error) {
      // Fail silently - tracking failures should not affect UX
      console.debug('[Tracking] Failed to track case view:', error.message);
    }
  },

  /**
   * Track case exit
   * PR: Comprehensive CaseHistory & Audit Trail
   * Logs when user exits case detail page
   * Fails silently if logging fails
   */
  trackCaseExit: async (caseId) => {
    try {
      await api.post(`/cases/${caseId}/track-exit`);
    } catch (error) {
      // Fail silently - tracking failures should not affect UX
      console.debug('[Tracking] Failed to track case exit:', error.message);
    }
  },

  /**
   * Get case history
   * PR: Comprehensive CaseHistory & Audit Trail
   * Returns chronological audit trail for a case
   */
  getCaseHistory: async (caseId) => {
    const response = await api.get(`/cases/${caseId}/history`);
    return response.data;
  },
};
