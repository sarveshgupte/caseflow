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

import React, { createContext, useState, useCallback, useEffect, useRef } from 'react';
import { authService } from '../services/authService';
import { STORAGE_KEYS } from '../utils/constants';
import { isSuperAdmin } from '../utils/authUtils';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true); // Start true, boot effect will resolve it
  const profileFetchAttemptedRef = useRef(null); // Token-based guard for profile hydration
  const authTokenRef = useRef(null); // Ensure auth is set once per access token

  useEffect(() => {
    let token = null;
    try {
      token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.warn('[AUTH] Unable to access storage during hydration.', error);
      setLoading(false);
      setIsHydrating(false);
      return;
    }

    if (!token) {
      setLoading(false);
      setIsHydrating(false);
      return;
    }

    fetchProfile()
      .catch((error) => {
        console.error('[AUTH] Profile hydration failed.', error);
      })
      .finally(() => {
        setLoading(false);
        setIsHydrating(false);
      });
  }, [fetchProfile]);

  const clearAuthStorage = useCallback((firmSlugToPreserve = null) => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (firmSlugToPreserve) {
        localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlugToPreserve);
      } else {
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      }
    } catch (error) {
      console.warn('[AUTH] Unable to update storage while clearing auth state.', error);
    }
  }, []);

  const resetAuthState = useCallback(() => {
    clearAuthStorage();
    setUser(null);
    setIsAuthenticated(false);
    profileFetchAttemptedRef.current = null;
    authTokenRef.current = null;
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
    try {
      if (firmSlug) {
        localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlug);
      } else {
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      }
    } catch (error) {
      console.warn('[AUTH] Unable to update storage while setting profile.', error);
    }

    // Set user state from API data only (never from localStorage)
    setUser(userData);
    
    // Authentication = valid user identity + role
    // SuperAdmin users don't have firmSlug, so role is the source of truth
    const isAuth = !!userData && !!userData.role;
    let accessToken = null;
    try {
      accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.warn('[AUTH] Unable to access storage while setting auth state.', error);
    }
    if (accessToken && authTokenRef.current !== accessToken) {
      authTokenRef.current = accessToken;
      setIsAuthenticated(isAuth);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    let accessToken = null;
    try {
      accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.warn('[AUTH] Unable to access storage while fetching profile.', error);
    }
    if (!accessToken) {
      resetAuthState();
      return { success: false, data: null };
    }

    if (profileFetchAttemptedRef.current === accessToken) {
      return { success: false, data: null };
    }
    profileFetchAttemptedRef.current = accessToken;

    try {
      // Always fetch from API - no cached user fallback
      const response = await authService.getProfile();

      if (response?.success && response.data) {
        setAuthFromProfile(response.data);
        return { success: true, data: response.data };
      }

      // Profile fetch returned unsuccessful response - clear auth state
      resetAuthState();
      return { success: false, data: null };
    } catch (err) {
      // Fail fast on auth errors (401/403) to avoid hidden polling loops
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        resetAuthState();
      }
      // For network errors or other failures, still allow the app to continue
      // The app will render login page since user state is null
      return { success: false, data: null, error: err };
    } finally {
      // Hydration completion is handled by the boot-time effect.
    }
  }, [resetAuthState, setAuthFromProfile]);

  const login = async (xID, password) => {
    try {
      const response = await authService.login(xID, password);
      
      if (response.success) {
        // Login successful - tokens are stored by authService
        // Caller should call fetchProfile() to hydrate user data
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
    let firmSlugToPreserve = null;
    if (preserveFirmSlug) {
      try {
        firmSlugToPreserve = user?.firmSlug || localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);
      } catch (error) {
        console.warn('[AUTH] Unable to access storage during logout.', error);
      }
    }

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
      try {
        if (mergedUser.firmSlug) {
          localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, mergedUser.firmSlug);
        }
      } catch (error) {
        console.warn('[AUTH] Unable to update storage while updating user.', error);
      }

      return mergedUser;
    });
  };

  const isAuthResolved = !loading && !isHydrating;

  const value = {
    user,
    loading,
    isAuthenticated,
    isHydrating,
    isAuthResolved,
    login,
    logout,
    fetchProfile,
    updateUser,
    setAuthFromProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
