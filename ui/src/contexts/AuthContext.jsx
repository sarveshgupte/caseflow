/**
 * Authentication Context
 * 
 * New Auth Contract (as of this PR):
 * ===================================
 * localStorage contains ONLY:
 *   - STORAGE_KEYS.ACCESS_TOKEN
 *   - STORAGE_KEYS.REFRESH_TOKEN  
 *   - STORAGE_KEYS.FIRM_SLUG (optional, routing hint only)
 * 
 * User data is NEVER stored in localStorage.
 * All user state is hydrated from /api/auth/profile on app mount.
 * The API is the single source of truth for user identity.
 */

import React, { createContext, useState, useCallback } from 'react';
import { authService } from '../services/authService';
import { STORAGE_KEYS } from '../utils/constants';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const clearAuthStorage = useCallback((firmSlugToPreserve = null) => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (firmSlugToPreserve) {
      localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlugToPreserve);
    } else {
      localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
    }
  }, []);

  const resetAuthState = useCallback(() => {
    clearAuthStorage();
    setUser(null);
    setIsAuthenticated(false);
  }, [clearAuthStorage]);

  /**
   * WARNING:
   * This function MUST NOT be called outside AuthContext.
   * Calling it elsewhere will cause auth bootstrap loops.
   */
  const setAuthFromProfile = useCallback((userData) => {
    if (!userData) return;

    const { firmSlug } = userData;

    // Only store firmSlug as a routing hint (optional)
    if (firmSlug) {
      localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlug);
    } else {
      localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
    }

    // Set user state from API data only (never from localStorage)
    setUser(userData);
    setIsAuthenticated(userData?.isSuperAdmin === true || !!userData?.firmSlug);
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!accessToken) {
        resetAuthState();
        return { success: false, data: null };
      }

      // Always fetch from API - no cached user fallback
      const response = await authService.getProfile();

      if (response?.success && response.data) {
        setAuthFromProfile(response.data);
        return { success: true, data: response.data };
      }

      return { success: false, data: null };
    } catch (err) {
      // Fail fast on auth errors (401/403) to avoid hidden polling loops
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        resetAuthState();
      }
      return { success: false, data: null, error: err };
    } finally {
      setLoading(false);
    }
  }, [resetAuthState, setAuthFromProfile]);

  const login = async (xID, password) => {
    try {
      const response = await authService.login(xID, password);
      
      if (response.success) {
        const userData = response.data;
        setAuthFromProfile(userData);
        return response;
      }

      const errorMessage = response.message || 'Login failed';
      throw new Error(errorMessage);
    } catch (error) {
      resetAuthState();
      throw error;
    }
  };

  const logout = async ({ preserveFirmSlug = false } = {}) => {
    const firmSlugToPreserve = preserveFirmSlug
      ? user?.firmSlug || localStorage.getItem(STORAGE_KEYS.FIRM_SLUG)
      : null;

    try {
      // Call backend logout endpoint
      await authService.logout(preserveFirmSlug);
    } catch (error) {
      // Even if backend call fails, clear client state
      console.error('Logout error:', error);
    } finally {
      // Always clear client-side state
      setUser(null);
      setIsAuthenticated(false);
      
      clearAuthStorage(firmSlugToPreserve);
    }
  };

  const updateUser = (userData) => {
    setUser((prev) => {
      const mergedUser = { ...prev, ...userData };

      // Only update firmSlug in localStorage as a routing hint
      if (mergedUser.firmSlug) {
        localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, mergedUser.firmSlug);
      }

      setIsAuthenticated(mergedUser?.isSuperAdmin === true || !!mergedUser?.firmSlug);
      return mergedUser;
    });
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    fetchProfile,
    updateUser,
    setAuthFromProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
