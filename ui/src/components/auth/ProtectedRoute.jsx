/**
 * Protected Route Component
 */

import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { usePermissions } from '../../hooks/usePermissions.js';
import { Loading } from '../common/Loading';

export const ProtectedRoute = ({ children, requireAdmin = false, requireSuperadmin = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const { isAdmin, isSuperadmin } = usePermissions();
  const { firmSlug } = useParams();

  if (loading) {
    return <Loading message="Loading..." />;
  }

  if (!isAuthenticated) {
    // Redirect to firm login if firmSlug is in URL, otherwise generic login
    if (firmSlug) {
      return <Navigate to={`/f/${firmSlug}/login`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // SuperAdmin trying to access superadmin routes
  if (requireSuperadmin && !isSuperadmin) {
    // If regular user has firmSlug, redirect to their dashboard
    if (user?.firmSlug) {
      return <Navigate to={`/${user.firmSlug}/dashboard`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // SuperAdmin trying to access regular/admin routes (block them)
  if (!requireSuperadmin && isSuperadmin) {
    return <Navigate to="/superadmin" replace />;
  }

  // Admin-only routes
  if (requireAdmin && !isAdmin) {
    // Redirect to user's firm dashboard
    if (user?.firmSlug) {
      return <Navigate to={`/${user.firmSlug}/dashboard`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return children;
};
