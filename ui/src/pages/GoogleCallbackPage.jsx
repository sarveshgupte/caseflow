/**
 * Google OAuth Callback Handler
 * Stores tokens from backend redirect and routes user appropriately.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { STORAGE_KEYS, USER_ROLES } from '../utils/constants';
import { useAuth } from '../hooks/useAuth';
import './LoginPage.css';

export const GoogleCallbackPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const { user, loading, isAuthenticated, setAuthFromProfile } = useAuth();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const firmSlugFromQuery = params.get('firmSlug');
  const errorParam = params.get('error');

  useEffect(() => {
    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (firmSlugFromQuery) {
      localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlugFromQuery);
    }
  }, [firmSlugFromQuery, errorParam]);

  useEffect(() => {
    if (error || loading) return;

    if (!isAuthenticated) {
      setError('Login session not found. Please sign in again.');
      return;
    }

    if (!user) {
      return;
    }

    setAuthFromProfile(user);

    const effectiveFirmSlug =
      firmSlugFromQuery ||
      user.firmSlug ||
      localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);

    if (user.role === USER_ROLES.SUPER_ADMIN) {
      navigate('/superadmin', { replace: true });
      return;
    }

    if (effectiveFirmSlug) {
      navigate(`/f/${effectiveFirmSlug}/dashboard`, { replace: true });
    } else {
      setError('Firm context missing. Please use your firm-specific login URL.');
    }
  }, [error, loading, isAuthenticated, user, firmSlugFromQuery, navigate, setAuthFromProfile]);

  return (
    <div className="login-page">
      <Card className="login-card">
        {error ? (
          <div className="error-message">{error}</div>
        ) : (
          <Loading message="Completing Google sign-in..." />
        )}
      </Card>
    </div>
  );
};
