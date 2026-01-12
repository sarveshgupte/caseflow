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
  const profileLoadAttempted = useRef(false);

  useEffect(() => {
    // Guard: Prevent multiple profile load attempts
    if (profileLoadAttempted.current) {
      return;
    }
    profileLoadAttempted.current = true;

    // Only proceed if we have a valid access token
    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!accessToken) {
      // No token, no user - just mark as done
      setLoading(false);
      return;
    }

    // Check if user is already logged in from localStorage
    const currentUser = authService.getCurrentUser();
    const xID = authService.getCurrentXID();
    
    if (currentUser && xID) {
      setUser(currentUser);
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

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
  }, []); // Empty dependency - runs once on mount, ref guard prevents re-execution

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
      profileLoadAttempted.current = false; // Reset guard to allow fresh login
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
