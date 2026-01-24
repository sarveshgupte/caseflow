/**
 * Set Password Page
 * Allows users to set their password using a token from email
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';
import { authService } from '../services/authService';
import { API_BASE_URL, APP_NAME } from '../utils/constants';
import './SetPasswordPage.css';

export const SetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing password setup token');
    }
  }, [token]);

  const validatePassword = (pwd) => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters long';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*]/.test(pwd)) {
      return 'Password must contain at least one special character (!@#$%^&*)';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing password setup token');
      return;
    }

    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await authService.setPassword(token, password);

      if (response.success) {
        setSuccess(true);
        // Use redirectUrl from backend (firm-scoped login)
        // Backend returns /f/{firmSlug}/login for admin users
        const redirectPath = response.redirectUrl || (response.firmSlug 
          ? `/f/${response.firmSlug}/login` 
          : '/login');
        setTimeout(() => {
          navigate(redirectPath);
        }, 2000);
      } else {
        setError(response.message || 'Failed to set password');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set password. The link may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/api/auth/google?flow=activation`;
  };

  if (success) {
    return (
      <div className="set-password-page">
        <Card className="set-password-card">
          <div className="set-password-success">
            <h1>✓ Password Set Successfully</h1>
            <p>Your password has been set. You can now log in.</p>
            <p className="text-secondary">Redirecting to login...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="set-password-page">
      <Card className="set-password-card">
        <div className="set-password-header">
          <h1>Set Your Password</h1>
          <p className="text-secondary">
            Welcome to {APP_NAME}! Please set your password to activate your account.
          </p>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            style={{ marginTop: '1rem' }}
            onClick={handleGoogleLogin}
          >
            Continue with Google
          </Button>
          <p className="text-secondary" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
            You can use your invited email with Google Sign-In. No new accounts will be created.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="set-password-form">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <Input
            label="New Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
          />

          <div className="password-requirements">
            <p className="text-secondary">Password Requirements:</p>
            <ul>
              <li className={password.length >= 8 ? 'valid' : ''}>
                At least 8 characters
              </li>
              <li className={/[A-Z]/.test(password) ? 'valid' : ''}>
                One uppercase letter
              </li>
              <li className={/[a-z]/.test(password) ? 'valid' : ''}>
                One lowercase letter
              </li>
              <li className={/[0-9]/.test(password) ? 'valid' : ''}>
                One number
              </li>
              <li className={/[!@#$%^&*]/.test(password) ? 'valid' : ''}>
                One special character (!@#$%^&*)
              </li>
            </ul>
          </div>

          <Button
            type="submit"
            variant="primary"
            fullWidth
            disabled={loading}
          >
            {loading ? 'Setting Password...' : 'Set Password'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
