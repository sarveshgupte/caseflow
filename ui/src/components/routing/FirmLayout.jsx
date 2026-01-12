/**
 * Firm Layout Component
 * Wrapper for all firm-scoped routes
 * Validates firm context and prevents cross-firm access
 */

import React from 'react';
import { Outlet, useParams, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loading } from '../common/Loading';

export const FirmLayout = () => {
  const { firmSlug } = useParams();
  const navigate = useNavigate();
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <Loading message="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to={`/f/${firmSlug}/login`} replace />;
  }

  // Validate that user's firmSlug matches URL firmSlug
  // This is the ONLY place where firm validation happens
  if (user?.firmSlug && user.firmSlug !== firmSlug) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Access Denied</h1>
        <p>You don't have access to this firm.</p>
        <button onClick={() => navigate(`/f/${user.firmSlug}/dashboard`, { replace: true })}>
          Go to Your Dashboard
        </button>
      </div>
    );
  }

  return <Outlet />;
};
