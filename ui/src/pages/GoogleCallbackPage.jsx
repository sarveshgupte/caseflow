/**
 * Google OAuth Callback Handler
 * Stores tokens from backend redirect and routes user appropriately.
 */

import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { STORAGE_KEYS, USER_ROLES } from '../utils/constants';
import './LoginPage.css';

export const GoogleCallbackPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const xID = params.get('xID');
    const role = params.get('role');
    const firmSlug = params.get('firmSlug');
    const name = params.get('name');
    const email = params.get('email');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(errorParam);
      return;
    }

    if (!accessToken || !refreshToken || !xID || !role) {
      setError('Missing login credentials. Please try signing in again.');
      return;
    }

    if (role === USER_ROLES.SUPER_ADMIN) {
      setError('SuperAdmin must use password login.');
      return;
    }

    // Persist tokens and minimal user data
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    localStorage.setItem(STORAGE_KEYS.X_ID, xID);
    localStorage.setItem(
      STORAGE_KEYS.USER,
      JSON.stringify({
        xID,
        role,
        firmSlug,
        name,
        email,
      })
    );

    // Redirect to firm dashboard when available
    if (firmSlug) {
      navigate(`/${firmSlug}/dashboard`, { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [location.search, navigate]);

  return (
    <div className="login-page">
      <Card className="login-card">
        {error ? (
          <div className="error-message" style={{ textAlign: 'center', color: '#e53e3e' }}>
            {error}
          </div>
        ) : (
          <Loading message="Completing Google sign-in..." />
        )}
      </Card>
    </div>
  );
};
