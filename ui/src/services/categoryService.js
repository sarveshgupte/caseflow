/**
 * Category Service
 */

import api from './api';

export const categoryService = {
  /**
   * Get all categories (with optional activeOnly filter)
   */
  getCategories: async (activeOnly = false) => {
    const response = await api.get('/categories', {
      params: { activeOnly: activeOnly ? 'true' : 'false' }
    });
    return response.data;
  },

  /**
   * Get category by ID
   */
  getCategoryById: async (id) => {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  },

  /**
   * Create a new category (Admin only)
   */
  createCategory: async (name) => {
    const response = await api.post('/categories', { name });
    return response.data;
  },

  /**
   * Update category name (Admin only)
   */
  updateCategory: async (id, name) => {
    const response = await api.put(`/categories/${id}`, { name });
    return response.data;
  },

  /**
   * Enable/disable category (Admin only)
   */
  toggleCategoryStatus: async (id, isActive) => {
    const response = await api.patch(`/categories/${id}/status`, { isActive });
    return response.data;
  },

  /**
   * Add subcategory to category (Admin only)
   */
  addSubcategory: async (categoryId, name) => {
    const response = await api.post(`/categories/${categoryId}/subcategories`, { name });
    return response.data;
  },

  /**
   * Update subcategory name (Admin only)
   */
  updateSubcategory: async (categoryId, subcategoryId, name) => {
    const response = await api.put(`/categories/${categoryId}/subcategories/${subcategoryId}`, { name });
    return response.data;
  },

  /**
   * Enable/disable subcategory (Admin only)
   */
  toggleSubcategoryStatus: async (categoryId, subcategoryId, isActive) => {
    const response = await api.patch(`/categories/${categoryId}/subcategories/${subcategoryId}/status`, { isActive });
    return response.data;
  },
};
