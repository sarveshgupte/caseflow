/**
 * Admin Service
 */

import api from './api';

export const adminService = {
  /**
   * Create new user (Admin only)
   */
  createUser: async (userData) => {
    const response = await api.post('/auth/admin/users', userData);
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
