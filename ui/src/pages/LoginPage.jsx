/**
 * Login Page
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { validateXID, validatePassword } from '../utils/validators';
import { USER_ROLES } from '../utils/constants';
import './LoginPage.css';

export const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get success message from location state if present
  const successMessage = location.state?.message;
  const messageType = location.state?.messageType;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    // Validation - xID only (no email)
    if (!validateXID(identifier)) {
      setError('Please enter a valid xID (e.g., X123456)');
      return;
    }

    if (!validatePassword(password)) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await login(identifier, password);

      if (response.success) {
        // Check if user is Superadmin - redirect to superadmin dashboard
        if (response.data.role === USER_ROLES.SUPER_ADMIN) {
          navigate('/superadmin');
        } else {
          // Regular users go to dashboard
          navigate('/dashboard');
        }
      }
    } catch (err) {
      const errorData = err.response?.data;
      
      if (errorData?.mustChangePassword) {
        // Redirect to change password page with identifier
        navigate('/change-password', { state: { xID: identifier } });
      } else if (errorData?.passwordSetupRequired) {
        // User needs to set password via email link
        setError('Please set your password using the link sent to your email. If you haven\'t received it, contact your administrator.');
      } else if (errorData?.lockedUntil) {
        // Account is locked
        setError(errorData?.message || 'Account is locked. Please try again later or contact an administrator.');
      } else {
        setError(errorData?.message || 'Invalid xID or password');
      }
    } finally {
      setLoading(false);
    }
  };

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
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            placeholder="X123456"
            autoFocus
          />
          <p style={{ 
            fontSize: '0.875rem', 
            color: 'var(--text-secondary)', 
            marginTop: '-0.5rem', 
            marginBottom: '1rem' 
          }}>
            Use your xID (case-insensitive, e.g., x123456 or X123456)
          </p>

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
          />

          {successMessage && messageType === 'success' && (
            <div className="neo-alert neo-alert--success" style={{ marginBottom: 'var(--spacing-md)' }}>
              {successMessage}
            </div>
          )}

          {error && (
            <div className="neo-alert neo-alert--danger" style={{ marginBottom: 'var(--spacing-md)' }}>
              {error}
            </div>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </Button>

          <div className="login-footer">
            <Link to="/forgot-password" className="forgot-password-link">
              Forgot Password?
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
};
