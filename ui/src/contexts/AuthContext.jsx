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
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { STORAGE_KEYS } from '../utils/constants';
import { isSuperAdmin } from '../utils/authUtils';

// Public routes that should trigger post-login redirects
const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/change-password', '/set-password'];

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true); // Start true, boot effect will resolve it
  const navigate = useNavigate();
  const location = useLocation();
  const bootHydrationAttemptedRef = useRef(false); // Guard against unintended re-runs

  /**
   * Post-login redirect logic - runs only after auth hydration completes.
   * This is the SINGLE place that handles routing after successful login.
   * LoginPage does NOT control routing.
   */
  useEffect(() => {
    // Only redirect after hydration completes and user is authenticated
    if (isHydrating || !isAuthenticated || !user) {
      return;
    }

    // Don't redirect if we're on a public route (login, password reset, etc)
    const isOnPublicRoute = PUBLIC_ROUTES.some(route => location.pathname.startsWith(route)) || 
                           location.pathname.match(/^\/f\/[^/]+\/login$/);
    
    if (!isOnPublicRoute) {
      // Not on a public route, so we don't need to redirect
      return;
    }

    // Determine target route based on user role
    if (isSuperAdmin(user)) {
      // Prevent redirect loop
      if (location.pathname !== '/superadmin') {
        navigate('/superadmin', { replace: true });
      }
      return;
    }

    // Firm users - redirect to their firm dashboard
    if (user.firmSlug) {
      const targetPath = `/f/${user.firmSlug}/dashboard`;
      // Prevent redirect loop
      if (location.pathname !== targetPath) {
        navigate(targetPath, { replace: true });
      }
      return;
    }
  }, [isAuthenticated, user, isHydrating, navigate, location.pathname]);

  /**
   * Boot-time hydration effect.
   * Runs ONCE on mount to auto-hydrate auth state when a valid token exists.
   * This ensures isHydrating always eventually becomes false.
   * 
   * Uses both empty dependency array AND ref guard for maximum clarity:
   * - Empty deps ensures React doesn't re-run on state changes
   * - Ref guard provides additional safety against unintended re-runs
   * - `user` is always `null` on initial mount (checked in condition)
   * - `fetchProfile` is stable (useCallback) and doesn't need to trigger re-runs
   * - We specifically want boot-time hydration only, not reactive hydration
   */
  useEffect(() => {
    // Guard: only run once on initial mount
    if (bootHydrationAttemptedRef.current) {
      return;
    }
    bootHydrationAttemptedRef.current = true;

    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

    // If token exists and user is not loaded, trigger hydration
    if (token && !user) {
      fetchProfile();
      return;
    }

    // No token → mark hydration complete immediately
    setIsHydrating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    
    // Authentication = valid user identity + role
    // SuperAdmin users don't have firmSlug, so role is the source of truth
    const isAuth = !!userData && !!userData.role;
    setIsAuthenticated(isAuth);
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setIsHydrating(true);
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
      // CRITICAL: Always set loading and hydrating to false
      // This ensures the app can render the login page even if API is down
      setLoading(false);
      setIsHydrating(false);
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

      // Authentication = valid user identity + role
      // SuperAdmin users don't have firmSlug, so role is the source of truth
      const isAuth = !!mergedUser && !!mergedUser.role;
      setIsAuthenticated(isAuth);
      return mergedUser;
    });
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    isHydrating,
    login,
    logout,
    fetchProfile,
    updateUser,
    setAuthFromProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
