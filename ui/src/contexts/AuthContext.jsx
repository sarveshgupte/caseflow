/**
 * Authentication Context
 */

import React, { createContext, useState, useEffect, useRef } from 'react';
import { authService } from '../services/authService';
import { STORAGE_KEYS } from '../utils/constants';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  /**
   * Execution guard to prevent infinite /api/auth/profile request loops.
   * 
   * This ref ensures profile fetching happens EXACTLY ONCE per component lifecycle.
   * 
   * WITHOUT this guard, the following issues occur:
   * - React StrictMode double-invokes effects in development, causing duplicate API calls
   * - Component remounts during auth state changes trigger redundant profile fetches
   * - Google OAuth multi-step authentication flows create cascading request loops
   * - Auth state updates cause useEffect re-evaluation, leading to infinite recursion
   * 
   * CRITICAL: DO NOT REMOVE this guard. Removing it will immediately reintroduce
   * the infinite loop bug that was fixed in PR #127.
   * 
   * The guard is reset to false in logout() to allow fresh profile loads after re-authentication.
   */
  const profileFetchAttemptedRef = useRef(false);

  useEffect(() => {
    // ============================================================================
    // GUARD: Prevent duplicate profile fetch attempts
    // ============================================================================
    // This guard ensures we only attempt to load the user profile ONCE per
    // component lifecycle. Without it, React StrictMode and component remounts
    // during auth state changes will trigger infinite /api/auth/profile loops.
    if (profileFetchAttemptedRef.current) {
      return;
    }
    profileFetchAttemptedRef.current = true;

    // ============================================================================
    // EARLY EXIT: No token means no authenticated user
    // ============================================================================
    // If no access token exists, the user is definitely not authenticated.
    // Skip all profile loading logic and immediately mark loading as complete.
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!accessToken) {
      setLoading(false);
      return;
    }

    // ============================================================================
    // EARLY EXIT: User data already cached in localStorage
    // ============================================================================
    // Check if user is already logged in from localStorage
    const currentUser = authService.getCurrentUser();
    const xID = authService.getCurrentXID();
    
    if (currentUser && xID) {
      setUser(currentUser);
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    // ============================================================================
    // PROFILE FETCH: Token exists but no cached user data
    // ============================================================================
    // If we have a token but no cached user, fetch from backend
    const bootstrapFromCookie = async () => {
      try {
        const response = await authService.getProfile();
        if (response?.success && response.data) {
          const userData = response.data;
          // Store user data to localStorage to prevent re-fetching on subsequent renders
          // Note: xID should always be present from backend; if missing, it indicates a backend issue
          localStorage.setItem(STORAGE_KEYS.X_ID, userData.xID);
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
          setUser(userData);
          setIsAuthenticated(true);
        }
      } catch (err) {
        // ignore - user not authenticated
      } finally {
        setLoading(false);
      }
    };

    bootstrapFromCookie();
  }, []); // Empty dependency array: runs once on mount. The ref guard prevents re-execution.

  const login = async (xID, password) => {
    const response = await authService.login(xID, password);
    
    if (response.success) {
      const userData = response.data;
      setUser(userData);
      setIsAuthenticated(true);
      return response;
    } else {
      // Login failed or requires password change - don't set auth state
      const errorMessage = response.message || 'Login failed';
      throw new Error(errorMessage);
    }
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint
      await authService.logout();
    } catch (error) {
      // Even if backend call fails, clear client state
      console.error('Logout error:', error);
    } finally {
      // Always clear client-side state
      setUser(null);
      setIsAuthenticated(false);
      
      // Reset the profile fetch guard to allow fresh profile load after re-authentication
      profileFetchAttemptedRef.current = false;
      
      // Force clear localStorage in case service didn't
      localStorage.removeItem(STORAGE_KEYS.X_ID);
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  };

  const updateUser = (userData) => {
    setUser((prev) => ({ ...prev, ...userData }));
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
