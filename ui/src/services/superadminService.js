/**
 * Superadmin Service
 * API calls for Superadmin platform management
 */

import api from './api';

export const superadminService = {
  /**
   * Get platform statistics
   */
  getPlatformStats: async () => {
    const response = await api.get('/superadmin/stats');
    return response.data;
  },

  /**
   * Create a new firm
   */
  createFirm: async (name, adminName, adminEmail) => {
    const response = await api.post('/superadmin/firms', { name, adminName, adminEmail });
    return response.data;
  },

  /**
   * List all firms
   */
  listFirms: async () => {
    const response = await api.get('/superadmin/firms');
    const responseData = response.data;
    const isArrayResponse = Array.isArray(responseData);
    const isSuccessfulStatus = response.status >= 200 && response.status < 300;
    const payload = isArrayResponse
      ? { success: isSuccessfulStatus, data: responseData }
      : responseData || {};
    const isNotModified = response.status === 304;
    // Treat 304 (Not Modified) as success so cached firm lists remain in place.
    const success = isNotModified || payload.success === true;
    return {
      ...payload,
      status: response.status,
      success,
    };
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
