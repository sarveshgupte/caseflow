/**
 * Firm Layout Component
 * Wrapper for all firm-scoped routes
 * Validates firm context and prevents cross-firm access
 */

import React from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Loading } from '../common/Loading';

export const FirmLayout = () => {
  const { firmSlug } = useParams();
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <Loading message="Checking firm access..." />;
  }

  // Validate that user's firmSlug matches URL firmSlug
  // This is the ONLY place where firm validation happens
  if (user?.firmSlug && user.firmSlug !== firmSlug) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Access denied</h1>
        <p>You tried to open firm "{firmSlug}", but your session is scoped to "{user.firmSlug}".</p>
        <p style={{ marginTop: '0.5rem', color: '#4b5563' }}>
          Switch back to your firm dashboard to continue safely.
        </p>
      </div>
    );
  }

  return <Outlet />;
};
