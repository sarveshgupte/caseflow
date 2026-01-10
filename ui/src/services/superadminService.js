/**
 * Superadmin Service
 * API calls for Superadmin platform management
 */

import api from './api';

export const superadminService = {
  /**
   * Create a new firm
   */
  createFirm: async (name) => {
    const response = await api.post('/superadmin/firms', { name });
    return response.data;
  },

  /**
   * List all firms
   */
  listFirms: async () => {
    const response = await api.get('/superadmin/firms');
    return response.data;
  },

  /**
   * Update firm status (activate/suspend)
   */
  updateFirmStatus: async (firmId, status) => {
    const response = await api.patch(`/superadmin/firms/${firmId}`, { status });
    return response.data;
  },

  /**
   * Create firm admin
   */
  createFirmAdmin: async (firmId, adminData) => {
    const response = await api.post(`/superadmin/firms/${firmId}/admin`, adminData);
    return response.data;
  },
};
