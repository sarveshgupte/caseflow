/**
 * Axios API Client Configuration
 * Updated for JWT Bearer token authentication
 */

import axios from 'axios';
import { API_BASE_URL, ERROR_CODES, SESSION_KEYS, STORAGE_KEYS } from '../utils/constants';
import { isAccessTokenOnlySession } from '../utils/authUtils';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

let redirecting = false;
const REDIRECT_TIMEOUT_MS = 5000;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 4000;

const generateIdempotencyKey = () => {
  if (typeof crypto?.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto?.getRandomValues === 'function') {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    buffer[6] = (buffer[6] & 0x0f) | 0x40;
    buffer[8] = (buffer[8] & 0x3f) | 0x80;
    const segments = [
      Array.from(buffer.slice(0, 4)),
      Array.from(buffer.slice(4, 6)),
      Array.from(buffer.slice(6, 8)),
      Array.from(buffer.slice(8, 10)),
      Array.from(buffer.slice(10)),
    ].map((segment) => segment.map((b) => b.toString(16).padStart(2, '0')).join(''));
    return segments.join('-');
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

// Request interceptor - Add JWT Bearer token
api.interceptors.request.use(
  (config) => {
    const method = (config.method || '').toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      if (!config.headers['Idempotency-Key']) {
        config.headers['Idempotency-Key'] = generateIdempotencyKey();
      }
    }

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
    if (response?.data?.idempotent === true) {
      window.dispatchEvent(new CustomEvent('app:idempotent'));
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (redirecting) {
      return Promise.reject(error);
    }
    const hasResponse = !!error.response;
    const status = error.response?.status;
    const firmSlug = localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);
    const redirectToLogin = () => {
      if (redirecting) return;
      redirecting = true;
      const destination = firmSlug ? `/f/${firmSlug}/login` : '/login';
      window.location.assign(destination);
      // Fallback reset in case navigation is blocked
      setTimeout(() => { redirecting = false; }, REDIRECT_TIMEOUT_MS);
    };
    const clearAuthStorage = () => {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
    };
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    // Network errors (no response) - retry with bounded exponential backoff
    if (!hasResponse) {
      const retries = originalRequest?._networkRetryCount || 0;
      if (retries < 2) {
        const backoffMs = Math.min(INITIAL_BACKOFF_MS * 2 ** retries, MAX_BACKOFF_MS);
        originalRequest._networkRetryCount = retries + 1;
        await delay(backoffMs);
        return api(originalRequest);
      }
      return Promise.reject(error);
    }
    
    // Handle token expiry
    if (status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isAccessTokenOnlySession()) {
        clearAuthStorage();
        sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
          message: 'Your admin session has expired. Please log in again.',
          type: 'info'
        }));
        redirectToLogin();
        return Promise.reject(error);
      }
      
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
        const refreshCode = refreshError?.code || refreshError?.response?.data?.code;
        sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
          message: refreshCode === ERROR_CODES.REFRESH_NOT_SUPPORTED
            ? 'Your admin session has expired. Please log in again.'
            : 'Your session expired. Please log in again.',
          type: 'info'
        }));
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }
    
    // Handle other 401 errors (invalid token, etc.)
    if (status === 401) {
      clearAuthStorage();
      sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
        message: 'Your session expired. Please log in again.',
        type: 'info'
      }));
      redirectToLogin();
      return Promise.reject(error);
    }

    // Handle authorization failures explicitly (stop silent polling)
    if (status === 403) {
      // Forbidden - clear storage and redirect to login
      clearAuthStorage();
      sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
        message: 'Access denied for this action. Please log in again.',
        type: 'warning'
      }));
      redirectToLogin();
      return Promise.reject(error);
    }
    
    return Promise.reject(error);
  }
);

export default api;
