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

  const bootstrapOnceRef = useRef(false);

  const setAuthFromProfile = (userData) => {
    if (!userData) return;

    const { firmSlug, xID } = userData;

    if (firmSlug) {
      localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlug);
    } else {
      localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
    }

    if (xID) {
      localStorage.setItem(STORAGE_KEYS.X_ID, xID);
    }

    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  useEffect(() => {
    if (bootstrapOnceRef.current) return;
    bootstrapOnceRef.current = true;

    const bootstrapAuth = async () => {
      try {
        const cachedUser = localStorage.getItem(STORAGE_KEYS.USER);
        const cachedXID = localStorage.getItem(STORAGE_KEYS.X_ID);

        if (cachedUser && cachedXID) {
          try {
            const parsedUser = JSON.parse(cachedUser);
            if (parsedUser?.xID && parsedUser.xID === cachedXID && parsedUser.role) {
              setAuthFromProfile(parsedUser);
              return;
            }
          } catch (parseError) {
            // Invalid cached user - fall back to server bootstrap
          }
        }

        const response = await authService.getProfile();

        if (response?.success && response.data) {
          setAuthFromProfile(response.data);
        }
      } catch (err) {
        // Not authenticated is a valid state - do not retry
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const login = async (xID, password) => {
    const response = await authService.login(xID, password);
    
    if (response.success) {
      const userData = response.data;
      setAuthFromProfile(userData);
      return response;
    } else {
      // Login failed or requires password change - don't set auth state
      const errorMessage = response.message || 'Login failed';
      throw new Error(errorMessage);
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
      bootstrapOnceRef.current = false;
      
      // Force clear localStorage in case service didn't
      localStorage.removeItem(STORAGE_KEYS.X_ID);
      localStorage.removeItem(STORAGE_KEYS.USER);
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);

      if (firmSlugToPreserve) {
        localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlugToPreserve);
      } else {
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      }
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
    setAuthFromProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
