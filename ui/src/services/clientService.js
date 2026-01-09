/**
 * Client Service
 * PR #39: Direct client management for Admin users
 * PR #49: Client lifecycle governance with controlled name changes
 */

import api from './api';

export const clientService = {
  /**
   * Get all clients (with optional activeOnly filter)
   */
  getClients: async (activeOnly = false) => {
    const response = await api.get('/clients', {
      params: { activeOnly: activeOnly ? 'true' : 'false' }
    });
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
};
