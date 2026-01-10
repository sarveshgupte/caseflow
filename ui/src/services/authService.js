/**
 * Authentication Service
 */

import api from './api';
import { STORAGE_KEYS } from '../utils/constants';

export const authService = {
  /**
   * Login with xID and password (or email for Superadmin)
   * Backend expects payload key as 'xID' (uppercase 'D') or 'email'
   */
  login: async (identifier, password) => {
    // Ensure password is always included in the request, even if empty
    // Detect if identifier is email (for Superadmin) or xID
    const isEmail = identifier.includes('@');
    const payload = {
      password: password || ''
    };
    
    if (isEmail) {
      payload.email = identifier;
    } else {
      payload.xID = identifier;
    }
    
    const response = await api.post('/auth/login', payload);
    
    if (response.data.success) {
      const { accessToken, refreshToken, data: userData } = response.data;
      
      // Store JWT tokens
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      
      // Store user data
      localStorage.setItem(STORAGE_KEYS.X_ID, userData.xID || 'SUPERADMIN');
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
    }
    // Don't store anything if login fails or requires password change
    
    return response.data;
  },

  /**
   * Logout
   */
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
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
   * Change password with xID (for users with mustChangePassword flag)
   */
  changePasswordWithXID: async (xID, currentPassword, newPassword) => {
    const response = await api.post('/auth/change-password', {
      xID,
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  /**
   * Set password using token from email
   */
  setPassword: async (token, password) => {
    const response = await api.post('/auth/set-password', {
      token,
      password,
    });
    return response.data;
  },

  /**
   * Forgot password - Request password reset email
   */
  forgotPassword: async (email) => {
    const response = await api.post('/auth/forgot-password', {
      email,
    });
    return response.data;
  },

  /**
   * Reset password with token (for forgot password flow)
   */
  resetPasswordWithToken: async (token, password) => {
    const response = await api.post('/auth/reset-password-with-token', {
      token,
      password,
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
    return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },
  
  /**
   * Refresh access token
   */
  refreshToken: async () => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const response = await api.post('/auth/refresh', {
      refreshToken,
    });
    
    if (response.data.success) {
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
    }
    
    return response.data;
  },
};
