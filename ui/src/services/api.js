/**
 * Axios API Client Configuration
 * Updated for JWT Bearer token authentication
 */

import axios from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT Bearer token
api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token expiry and refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const firmSlug = localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);
    const redirectToLogin = () => {
      if (firmSlug) {
        window.location.href = `/f/${firmSlug}/login`;
      } else {
        window.location.href = '/login';
      }
    };
    const clearAuthStorage = () => {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.X_ID);
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
    };
    
    // Handle token expiry
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt to refresh token
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        // Use the configured api instance for consistency
        const response = await api.post('/auth/refresh', {
          refreshToken,
        });
        
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;
        
        // Store new tokens
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
        
        // Retry original request with new token
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear storage and redirect to login
        clearAuthStorage();
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }
    
    // Handle other 401 errors (invalid token, etc.)
    if (error.response?.status === 401) {
      // Unauthorized - clear storage and redirect to login
      clearAuthStorage();
      redirectToLogin();
    }
    
    return Promise.reject(error);
  }
);

export default api;
