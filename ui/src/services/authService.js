/**
 * Authentication Service
 */

import api from './api';
import { STORAGE_KEYS } from '../utils/constants';
import { buildStoredUser, getStoredUser, isAccessTokenOnlyUser } from '../utils/authUtils';

export const authService = {
  /**
   * Login with xID and password
   * Backend expects payload key as 'xID' (uppercase 'D')
   */
  login: async (identifier, password) => {
    // Send xID only (no email login supported)
    const payload = {
      xID: identifier,
      password: password || ''
    };
    
    const response = await api.post('/auth/login', payload);
    
    if (response.data.success) {
      const {
        accessToken,
        refreshToken,
        data: userData,
        isSuperAdmin,
        refreshEnabled,
      } = response.data;
      const accessTokenOnly = isAccessTokenOnlyUser({
        ...userData,
        isSuperAdmin,
        refreshEnabled,
      });
      
      // Store JWT tokens
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      if (!accessTokenOnly && refreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      } else {
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      }
      
      // Store user data
      const storedUser = buildStoredUser(userData, refreshEnabled);
      localStorage.setItem(STORAGE_KEYS.X_ID, userData?.xID || 'SUPERADMIN');
      if (userData.firmSlug) {
        localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, userData.firmSlug);
      } else {
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      }
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(storedUser));
    }
    // Don't store anything if login fails or requires password change
    
    return response.data;
  },

  /**
   * Logout
   */
  logout: async (preserveFirmSlug = false) => {
    const firmSlugToPreserve = preserveFirmSlug
      ? localStorage.getItem(STORAGE_KEYS.FIRM_SLUG)
      : null;

    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.X_ID);
      localStorage.removeItem(STORAGE_KEYS.USER);
      
      if (!firmSlugToPreserve) {
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      } else {
        localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlugToPreserve);
      }
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
    const storedUser = getStoredUser();
    const accessTokenOnly = isAccessTokenOnlyUser(storedUser);
    if (accessTokenOnly) {
      const error = new Error('Refresh not supported for this session');
      error.code = 'REFRESH_NOT_SUPPORTED';
      throw error;
    }
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
