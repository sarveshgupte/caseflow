/**
 * Default Route Handler
 * Redirects users to appropriate dashboard based on role
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { Loading } from '../common/Loading';
import { STORAGE_KEYS } from '../../utils/constants';

export const DefaultRoute = () => {
  const { isAuthenticated, loading, user } = useAuth();
  const { isSuperadmin } = usePermissions();
  const storedFirmSlug = localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);

  if (loading) {
    return <Loading message="Loading..." />;
  }

  if (!isAuthenticated) {
    if (storedFirmSlug) {
      return <Navigate to={`/f/${storedFirmSlug}/login`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Redirect SuperAdmin to platform dashboard
  if (isSuperadmin) {
    return <Navigate to="/superadmin" replace />;
  }

  // Redirect regular users to their firm dashboard
  if (user?.firmSlug) {
    return <Navigate to={`/f/${user.firmSlug}/dashboard`} replace />;
  }

  if (storedFirmSlug) {
    return <Navigate to={`/f/${storedFirmSlug}/dashboard`} replace />;
  }

  // Fallback to generic login if no firm context
  return <Navigate to="/login" replace />;
};
