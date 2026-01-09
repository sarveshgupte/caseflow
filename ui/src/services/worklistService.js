/**
 * Worklist Service
 */

import api from './api';

export const worklistService = {
  /**
   * Get employee worklist (my cases)
   * PR: Hard Cutover to xID - Removed email parameter, relies on auth middleware
   */
  getEmployeeWorklist: async () => {
    const response = await api.get('/worklists/employee/me');
    return response.data;
  },

  /**
   * Get global worklist (unassigned cases)
   */
  getGlobalWorklist: async (filters = {}) => {
    const params = new URLSearchParams();
    
    if (filters.clientId) params.append('clientId', filters.clientId);
    if (filters.category) params.append('category', filters.category);
    if (filters.createdAtFrom) params.append('createdAtFrom', filters.createdAtFrom);
    if (filters.createdAtTo) params.append('createdAtTo', filters.createdAtTo);
    if (filters.slaStatus) params.append('slaStatus', filters.slaStatus);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    
    const queryString = params.toString();
    const url = `/worklists/global${queryString ? `?${queryString}` : ''}`;
    const response = await api.get(url);
    return response.data;
  },

  /**
   * Pull one or multiple cases from global worklist
   * User identity is obtained from authentication token, not passed in body
   * 
   * PR: Hard Cutover to xID - Unified pull endpoint
   */
  pullCases: async (caseIds) => {
    // Ensure caseIds is an array
    const ids = Array.isArray(caseIds) ? caseIds : [caseIds];
    const response = await api.post('/cases/pull', { caseIds: ids });
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
