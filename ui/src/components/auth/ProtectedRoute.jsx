/**
 * Protected Route Component
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { Loading } from '../common/Loading';

export const ProtectedRoute = ({ children, requireAdmin = false, requireSuperadmin = false }) => {
  const { isAuthenticated, loading } = useAuth();
  const { isAdmin, isSuperadmin } = usePermissions();

  if (loading) {
    return <Loading message="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // SuperAdmin trying to access superadmin routes
  if (requireSuperadmin && !isSuperadmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // SuperAdmin trying to access regular/admin routes (block them)
  if (!requireSuperadmin && isSuperadmin) {
    return <Navigate to="/superadmin" replace />;
  }

  // Admin-only routes
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
