/**
 * Admin Service
 */

import api from './api';

export const adminService = {
  /**
   * Get admin dashboard statistics (PR #41)
   */
  getAdminStats: async () => {
    const response = await api.get('/admin/stats');
    return response.data;
  },

  /**
   * Create new user (Admin only)
   */
  createUser: async (userData) => {
    const response = await api.post('/auth/admin/users', userData);
    return response.data;
  },

  /**
   * Get all users (Admin only)
   */
  getUsers: async (params = {}) => {
    const queryParams = new URLSearchParams(params).toString();
    const response = await api.get(`/auth/admin/users${queryParams ? '?' + queryParams : ''}`);
    return response.data;
  },

  /**
   * Update user status (Admin only)
   */
  updateUserStatus: async (xID, active) => {
    const response = await api.patch(`/users/${xID}/status`, { active });
    return response.data;
  },

  /**
   * Activate user (Admin only)
   */
  activateUser: async (xID) => {
    const response = await api.put(`/auth/admin/users/${xID}/activate`);
    return response.data;
  },

  /**
   * Deactivate user (Admin only)
   */
  deactivateUser: async (xID) => {
    const response = await api.put(`/auth/admin/users/${xID}/deactivate`);
    return response.data;
  },

  /**
   * Reset user password (Admin only)
   */
  resetPassword: async (xID) => {
    const response = await api.post('/auth/reset-password', { xID });
    return response.data;
  },

  /**
   * Resend password setup email (Admin only)
   * PR #48: Updated to use dedicated admin endpoint
   */
  resendSetupEmail: async (xID) => {
    const response = await api.post(`/admin/users/${xID}/resend-invite`);
    return response.data;
  },

  /**
   * Unlock user account (Admin only)
   */
  unlockAccount: async (xID) => {
    const response = await api.post('/auth/unlock-account', { xID });
    return response.data;
  },

  /**
   * Get pending approval cases
   */
  getPendingApprovals: async () => {
    const response = await api.get('/cases?status=Pending');
    return response.data;
  },

  /**
   * Approve new client case
   */
  approveNewClient: async (caseId, comment = '') => {
    const response = await api.post(`/client-approval/${caseId}/approve-new`, {
      comment,
    });
    return response.data;
  },

  /**
   * Approve client edit case
   */
  approveClientEdit: async (caseId, comment = '') => {
    const response = await api.post(`/client-approval/${caseId}/approve-edit`, {
      comment,
    });
    return response.data;
  },

  /**
   * Reject client case
   */
  rejectCase: async (caseId, comment) => {
    const response = await api.post(`/client-approval/${caseId}/reject`, {
      comment,
    });
    return response.data;
  },

  /**
   * List all clients
   */
  listClients: async () => {
    const response = await api.get('/client-approval/clients');
    return response.data;
  },

  /**
   * Get client by ID
   */
  getClientById: async (clientId) => {
    const response = await api.get(`/client-approval/clients/${clientId}`);
    return response.data;
  },
};
