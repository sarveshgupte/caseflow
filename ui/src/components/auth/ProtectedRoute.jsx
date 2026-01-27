/**
 * Protected Route Component
 * Handles authentication and role-based access
 */

import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { SESSION_KEYS, STORAGE_KEYS } from '../../utils/constants.js';
import { isSuperAdmin } from '../../utils/authUtils.js';
import { Loading } from '../common/Loading';

// Use sessionStorage to persist toasts across redirects in auth guard flows.
const setAccessToast = (message) => {
  sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
    message,
    type: 'warning'
  }));
};

export const ProtectedRoute = ({ children, requireAdmin = false, requireSuperadmin = false }) => {
  const { isAuthenticated, isAuthResolved, user } = useAuth();
  const { isAdmin } = usePermissions();
  const { firmSlug } = useParams();
  const storedFirmSlug = localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);
  const effectiveFirmSlug = firmSlug || storedFirmSlug;
  const isSuperAdminUser = isSuperAdmin(user);

  // Multi-tenancy guard: Detect firm slug mismatches
  if (firmSlug && storedFirmSlug && firmSlug !== storedFirmSlug) {
    console.warn(`[TENANCY] Firm slug mismatch detected. URL firm="${firmSlug}", session firm="${storedFirmSlug}"`);
  }

  if (user?.firmSlug && firmSlug && user.firmSlug !== firmSlug) {
    console.warn(`[TENANCY] Attempted cross-firm access blocked in UI. User firm="${user.firmSlug}", requested firm="${firmSlug}"`);
  }

  // Wait for auth hydration to complete
  if (!isAuthResolved) {
    return <Loading message="Checking access..." />;
  }

  // 1. Authentication check: User must be authenticated
  if (!isAuthenticated) {
    const hadSession = !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (hadSession) {
      sessionStorage.setItem(SESSION_KEYS.GLOBAL_TOAST, JSON.stringify({
        message: 'Your session expired. Please sign in again.',
        type: 'info'
      }));
    }
    return <Navigate to="/login" replace />;
  }

  // 2. Firm context check: Non-SuperAdmin users must have firm context
  // SuperAdmin users operate without firm context and access all system data
  if (!effectiveFirmSlug && !isSuperAdminUser) {
    return <Navigate to="/login" replace />;
  }

  // 3. SuperAdmin route authorization
  if (requireSuperadmin && !isSuperAdminUser) {
    // Non-SuperAdmin users trying to access SuperAdmin routes
    if (effectiveFirmSlug) {
      setAccessToast('SuperAdmin access is required to view that page.');
      return <Navigate to={`/f/${effectiveFirmSlug}/dashboard`} replace />;
    }
    setAccessToast('SuperAdmin access is required to view that page.');
    return <Navigate to="/login" replace />;
  }

  // 4. Firm route authorization: SuperAdmin users cannot access firm routes
  // They use a separate routing namespace (/superadmin)
  if (!requireSuperadmin && isSuperAdminUser) {
    return <Navigate to="/superadmin" replace />;
  }

  // 5. Admin-only route authorization
  if (requireAdmin && !isAdmin) {
    setAccessToast('Admin access is required to view that page.');
    return <Navigate to={`/f/${effectiveFirmSlug}/dashboard`} replace />;
  }

  return children;
};
