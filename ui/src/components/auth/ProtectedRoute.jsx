/**
 * Protected Route Component
 * Handles authentication and role-based access
 */

import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { STORAGE_KEYS } from '../../utils/constants.js';
import { Loading } from '../common/Loading';

export const ProtectedRoute = ({ children, requireAdmin = false, requireSuperadmin = false }) => {
  const { isAuthenticated, loading } = useAuth();
  const { isAdmin, isSuperadmin } = usePermissions();
  const { firmSlug } = useParams();
  const storedFirmSlug = localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);
  const effectiveFirmSlug = firmSlug || storedFirmSlug;

  if (loading) {
    return <Loading message="Loading..." />;
  }

  if (!isAuthenticated) {
    // Redirect to firm login if firmSlug is in URL, otherwise generic login
    if (effectiveFirmSlug) {
      return <Navigate to={`/f/${effectiveFirmSlug}/login`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // SuperAdmin trying to access superadmin routes
  if (requireSuperadmin && !isSuperadmin) {
    // Redirect authenticated users to their firm dashboard
    if (effectiveFirmSlug) {
      return <Navigate to={`/f/${effectiveFirmSlug}/dashboard`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // SuperAdmin trying to access regular/admin routes (block them)
  if (!requireSuperadmin && isSuperadmin) {
    return <Navigate to="/superadmin" replace />;
  }

  // Admin-only routes
  if (requireAdmin && !isAdmin) {
    // Redirect to dashboard (firmSlug will be in URL already via FirmLayout)
    return <Navigate to={`/f/${effectiveFirmSlug}/dashboard`} replace />;
  }

  return children;
};
