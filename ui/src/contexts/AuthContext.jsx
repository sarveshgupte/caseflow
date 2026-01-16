/**
 * Authentication Context
 */

import React, { createContext, useState, useCallback } from 'react';
import { authService } from '../services/authService';
import { STORAGE_KEYS, USER_ROLES } from '../utils/constants';
import { buildStoredUser, getStoredUser } from '../utils/authUtils';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const clearAuthStorage = useCallback((firmSlugToPreserve = null) => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.X_ID);
    localStorage.removeItem(STORAGE_KEYS.USER);
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
    let refreshEnabled = userData.refreshEnabled;
    if (refreshEnabled === undefined) {
      const cachedUser = getStoredUser();
      refreshEnabled = cachedUser?.refreshEnabled;
    }

    const { firmSlug, xID } = userData;

    if (firmSlug) {
      localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlug);
    } else {
      localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
    }

    if (xID) {
      localStorage.setItem(STORAGE_KEYS.X_ID, xID);
    }

    const nextUser = buildStoredUser(userData, refreshEnabled);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(nextUser));
    setUser(nextUser);
    setIsAuthenticated(true);
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!accessToken) {
        resetAuthState();
        return { success: false, data: null };
      }

      const cachedUser = localStorage.getItem(STORAGE_KEYS.USER);
      const cachedXID = localStorage.getItem(STORAGE_KEYS.X_ID);

      if (cachedUser && cachedXID) {
        try {
          const parsedUser = JSON.parse(cachedUser);
          const hasValidXID = typeof parsedUser?.xID === 'string' && parsedUser.xID.trim().length > 0;
          const isValidRole = Object.values(USER_ROLES).includes(parsedUser?.role);

          if (hasValidXID && parsedUser.xID === cachedXID && isValidRole) {
            setAuthFromProfile(parsedUser);
            return { success: true, data: parsedUser };
          }
        } catch (parseError) {
          // Invalid cached user - fall back to server bootstrap
        }
      }

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

      if (mergedUser.firmSlug) {
        localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, mergedUser.firmSlug);
      }

      if (mergedUser.xID) {
        localStorage.setItem(STORAGE_KEYS.X_ID, mergedUser.xID);
      }

      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(mergedUser));
      setIsAuthenticated(true);
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
