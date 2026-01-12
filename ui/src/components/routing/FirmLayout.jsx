/**
 * Firm Layout Component
 * Wrapper for all firm-scoped routes
 * Validates firm context and prevents cross-firm access
 */

import React, { useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loading } from '../common/Loading';

export const FirmLayout = () => {
  const { firmSlug } = useParams();
  const { user, loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If not authenticated, redirect to firm login
    if (!loading && !isAuthenticated) {
      navigate(`/f/${firmSlug}/login`, { replace: true });
    }
  }, [loading, isAuthenticated, firmSlug, navigate]);

  if (loading) {
    return <Loading message="Loading..." />;
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  // Validate that user's firmSlug matches URL firmSlug
  // This is the ONLY place where firm validation happens
  if (user?.firmSlug && user.firmSlug !== firmSlug) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Access Denied</h1>
        <p>You don't have access to this firm.</p>
        <button onClick={() => navigate(`/f/${user.firmSlug}/dashboard`)}>
          Go to Your Dashboard
        </button>
      </div>
    );
  }

  return <Outlet />;
};
