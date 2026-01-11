/**
 * Client Service
 * PR #39: Direct client management for Admin users
 * PR #49: Client lifecycle governance with controlled name changes
 * PR: Client Fact Sheet Foundation
 */

import api from './api';

export const clientService = {
  /**
   * Get all clients (with optional activeOnly filter)
   * @param {boolean} activeOnly - If true, only return active clients
   * @param {boolean} forCreateCase - If true, always include Default Client + active clients
   */
  getClients: async (activeOnly = false, forCreateCase = false) => {
    const params = {};
    if (forCreateCase) {
      params.forCreateCase = 'true';
    } else {
      params.activeOnly = activeOnly ? 'true' : 'false';
    }
    const response = await api.get('/clients', { params });
    return response.data;
  },

  /**
   * Get client by clientId
   */
  getClientById: async (clientId) => {
    const response = await api.get(`/clients/${clientId}`);
    return response.data;
  },

  /**
   * Create a new client (Admin only)
   */
  createClient: async (clientData) => {
    const response = await api.post('/clients', clientData);
    return response.data;
  },

  /**
   * Update client (Admin only)
   * Only allows updating: businessEmail, primaryContactNumber, secondaryContactNumber
   */
  updateClient: async (clientId, clientData) => {
    const response = await api.put(`/clients/${clientId}`, clientData);
    return response.data;
  },

  /**
   * Enable/disable client (Admin only)
   */
  toggleClientStatus: async (clientId, isActive) => {
    const response = await api.patch(`/clients/${clientId}/status`, { isActive });
    return response.data;
  },

  /**
   * Change client legal name (Admin only)
   * Requires newBusinessName and reason for audit compliance
   */
  changeLegalName: async (clientId, newBusinessName, reason) => {
    const response = await api.post(`/clients/${clientId}/change-name`, {
      newBusinessName,
      reason,
    });
    return response.data;
  },

  /**
   * Update Client Fact Sheet (Admin only)
   * Update description and notes for client fact sheet
   */
  updateClientFactSheet: async (clientId, description, notes) => {
    const response = await api.put(`/clients/${clientId}/fact-sheet`, {
      description,
      notes,
    });
    return response.data;
  },

  /**
   * Upload file to Client Fact Sheet (Admin only)
   * @param {string} clientId - Client ID
   * @param {File} file - File to upload
   */
  uploadFactSheetFile: async (clientId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/clients/${clientId}/fact-sheet/files`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Delete file from Client Fact Sheet (Admin only)
   */
  deleteFactSheetFile: async (clientId, fileId) => {
    const response = await api.delete(`/clients/${clientId}/fact-sheet/files/${fileId}`);
    return response.data;
  },

  /**
   * Get Client Fact Sheet for a case (Read-Only)
   * Available to all case-accessible users
   */
  getClientFactSheetForCase: async (caseId) => {
    const response = await api.get(`/cases/${caseId}/client-fact-sheet`);
    return response.data;
  },

  /**
   * Get view URL for a client fact sheet file
   * @param {string} caseId - Case ID
   * @param {string} fileId - File ID
   * @returns {string} View URL
   */
  getClientFactSheetFileViewUrl: (caseId, fileId) => {
    return `/cases/${caseId}/client-fact-sheet/files/${fileId}/view`;
  },
};
