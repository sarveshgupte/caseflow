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

const setAccessToast = (message) => {
  sessionStorage.setItem('GLOBAL_TOAST', JSON.stringify({
    message,
    type: 'warning'
  }));
};

export const ProtectedRoute = ({ children, requireAdmin = false, requireSuperadmin = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const { isAdmin, isSuperadmin } = usePermissions();
  const { firmSlug } = useParams();
  const storedFirmSlug = localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);
  const effectiveFirmSlug = firmSlug || storedFirmSlug;
  const isSuperAdminUser = user?.isSuperAdmin === true || isSuperadmin;

  if (firmSlug && storedFirmSlug && firmSlug !== storedFirmSlug) {
    console.warn(`[TENANCY] Firm slug mismatch detected. URL firm="${firmSlug}", session firm="${storedFirmSlug}"`);
  }

  if (user?.firmSlug && firmSlug && user.firmSlug !== firmSlug) {
    console.warn(`[TENANCY] Attempted cross-firm access blocked in UI. User firm="${user.firmSlug}", requested firm="${firmSlug}"`);
  }

  if (loading) {
    return <Loading message="Checking access..." />;
  }

  if (!isAuthenticated) {
    const hadSession = !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (hadSession) {
      sessionStorage.setItem('GLOBAL_TOAST', JSON.stringify({
        message: 'Your session expired. Please sign in again.',
        type: 'info'
      }));
    }
    return <Navigate to="/login" replace />;
  }

  // Authenticated users must have firm context unless they are SuperAdmin.
  if (!effectiveFirmSlug && !isSuperAdminUser) {
    return <Navigate to="/login" replace />;
  }

  // SuperAdmin trying to access superadmin routes
  if (requireSuperadmin && !isSuperAdminUser) {
    // Redirect authenticated users to their firm dashboard
    if (effectiveFirmSlug) {
      setAccessToast('SuperAdmin access is required to view that page.');
      return <Navigate to={`/f/${effectiveFirmSlug}/dashboard`} replace />;
    }
    setAccessToast('SuperAdmin access is required to view that page.');
    return <Navigate to="/login" replace />;
  }

  // SuperAdmin trying to access regular/admin routes (block them)
  if (!requireSuperadmin && isSuperAdminUser) {
    return <Navigate to="/superadmin" replace />;
  }

  // Admin-only routes
  if (requireAdmin && !isAdmin) {
    // Redirect to dashboard (firmSlug will be in URL already via FirmLayout)
    setAccessToast('Admin access is required to view that page.');
    return <Navigate to={`/f/${effectiveFirmSlug}/dashboard`} replace />;
  }

  return children;
};
