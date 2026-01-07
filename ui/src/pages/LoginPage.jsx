/**
 * Login Page
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { validateXID, validatePassword } from '../utils/validators';
import './LoginPage.css';

export const LoginPage = () => {
  const [xID, setXID] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!validateXID(xID)) {
      setError('Please enter a valid xID');
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await login(xID, password);

      if (response.data.requirePasswordChange) {
        setNeedsPasswordChange(true);
      } else if (response.data.passwordExpired) {
        setNeedsPasswordChange(true);
        setError('Your password has expired. Please change it.');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');

    if (!validatePassword(newPassword)) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // Note: This would need the changePassword service
      // For now, just redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  if (needsPasswordChange) {
    return (
      <div className="login-page">
        <Card className="login-card">
          <div className="login-header">
            <h1>Change Password</h1>
            <p className="text-secondary">Please set a new password to continue</p>
          </div>

          <form onSubmit={handlePasswordChange}>
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              placeholder="Enter new password"
            />

            <Input
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm new password"
            />

            {error && (
              <div className="neo-alert neo-alert--danger" style={{ marginBottom: 'var(--spacing-md)' }}>
                {error}
              </div>
            )}

            <Button type="submit" variant="primary" className="w-full" disabled={loading}>
              {loading ? 'Changing Password...' : 'Change Password'}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-header">
          <h1>Docketra</h1>
          <p className="text-secondary">Case Management System</p>
        </div>

        <form onSubmit={handleLogin}>
          <Input
            label="xID"
            type="text"
            value={xID}
            onChange={(e) => setXID(e.target.value)}
            required
            placeholder="Enter your xID"
            autoFocus
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
          />

          {error && (
            <div className="neo-alert neo-alert--danger" style={{ marginBottom: 'var(--spacing-md)' }}>
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </Card>
    </div>
  );
};
