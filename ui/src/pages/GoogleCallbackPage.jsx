/**
 * Google OAuth Callback Handler
 * Stores tokens from backend redirect and routes user appropriately.
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { STORAGE_KEYS, USER_ROLES } from '../utils/constants';
import { authService } from '../services/authService';
import './LoginPage.css';

export const GoogleCallbackPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const firmSlug = params.get('firmSlug');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(errorParam);
      return;
    }

    const bootstrapSession = async () => {
      try {
        const response = await authService.getProfile();
        if (response?.success && response.data) {
          const profile = response.data;
          localStorage.setItem(STORAGE_KEYS.X_ID, profile.xID || 'UNKNOWN');
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile));

          // Determine redirect path based on user role and firm context
          // NEVER redirect firm users to /login (SuperAdmin-only page)
          const effectiveFirmSlug = firmSlug || profile.firmSlug;
          
          if (profile.role === USER_ROLES.SUPER_ADMIN) {
            // SuperAdmin goes to SuperAdmin dashboard
            navigate('/superadmin', { replace: true });
          } else if (effectiveFirmSlug) {
            // Firm users go to their firm dashboard
            navigate(`/${effectiveFirmSlug}/dashboard`, { replace: true });
          } else {
            // Edge case: firm user without firm context - show error
            setError('Firm context missing. Please use your firm-specific login URL.');
          }
          return;
        }
        setError('Login session not found. Please sign in again.');
      } catch (err) {
        setError('Login session not found. Please sign in again.');
      }
    };

    bootstrapSession();
  }, [location.search, navigate]);

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
