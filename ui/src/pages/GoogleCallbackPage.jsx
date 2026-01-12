/**
 * Google OAuth Callback Handler
 * Stores tokens from backend redirect and routes user appropriately.
 */

import React, { useEffect, useState } from 'react';
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
  const { user, loading, isAuthenticated } = useAuth();
  const params = new URLSearchParams(location.search);
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

    if (!isAuthenticated || !user) return;

    const effectiveFirmSlug =
      firmSlugFromQuery ||
      user.firmSlug;

    if (user.role === USER_ROLES.SUPER_ADMIN) {
      navigate('/superadmin', { replace: true });
      return;
    }

    if (effectiveFirmSlug) {
      navigate(`/f/${effectiveFirmSlug}/dashboard`, { replace: true });
      return;
    }

    setError('Firm context missing.');
  }, [error, loading, isAuthenticated, user, firmSlugFromQuery, navigate]);

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
