/**
 * Worklist Service
 */

import api from './api';

export const worklistService = {
  /**
   * Get employee worklist (my cases)
   */
  getEmployeeWorklist: async (email) => {
    const params = email ? `?email=${encodeURIComponent(email)}` : '';
    const response = await api.get(`/worklists/employee/me${params}`);
    return response.data;
  },

  /**
   * Get category worklist
   */
  getCategoryWorklist: async (categoryId) => {
    const response = await api.get(`/worklists/category/${categoryId}`);
    return response.data;
  },

  /**
   * Search cases globally
   */
  searchCases: async (query) => {
    const response = await api.get(`/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },
};
