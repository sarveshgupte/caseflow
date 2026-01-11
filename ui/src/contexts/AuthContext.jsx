/**
 * Authentication Context
 */

import React, { createContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const currentUser = authService.getCurrentUser();
    const xID = authService.getCurrentXID();
    
    if (currentUser && xID) {
      setUser(currentUser);
      setIsAuthenticated(true);
      setLoading(false);
      return;
    }

    const bootstrapFromCookie = async () => {
      try {
        const response = await authService.getProfile();
        if (response?.success && response.data) {
          setUser(response.data);
          setIsAuthenticated(true);
        }
      } catch (err) {
        // ignore - user not authenticated
      } finally {
        setLoading(false);
      }
    };

    bootstrapFromCookie();
  }, []);

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
      // Force clear localStorage in case service didn't
      localStorage.removeItem('xID');
      localStorage.removeItem('user');
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
