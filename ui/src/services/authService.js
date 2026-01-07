/**
 * Authentication Service
 */

import api from './api';
import { STORAGE_KEYS } from '../utils/constants';

export const authService = {
  /**
   * Login with xID and password
   * Backend expects payload key as 'xID' (uppercase 'D')
   */
  login: async (xID, password) => {
    const response = await api.post('/auth/login', { xID, password });
    
    if (response.data.success) {
      const { xID: userXID, user } = response.data.data;
      localStorage.setItem(STORAGE_KEYS.X_ID, userXID);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    
    return response.data;
  },

  /**
   * Logout
   */
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem(STORAGE_KEYS.X_ID);
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  },

  /**
   * Change password
   */
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.post('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  /**
   * Get user profile
   */
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  /**
   * Update user profile
   */
  updateProfile: async (profileData) => {
    const response = await api.put('/auth/profile', profileData);
    
    if (response.data.success) {
      // Update stored user data
      const storedUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || '{}');
      const updatedUser = { ...storedUser, ...response.data.data };
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updatedUser));
    }
    
    return response.data;
  },

  /**
   * Get current user from storage
   */
  getCurrentUser: () => {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    return userStr ? JSON.parse(userStr) : null;
  },

  /**
   * Get current xID from storage
   */
  getCurrentXID: () => {
    return localStorage.getItem(STORAGE_KEYS.X_ID);
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: () => {
    return !!localStorage.getItem(STORAGE_KEYS.X_ID);
  },
};
