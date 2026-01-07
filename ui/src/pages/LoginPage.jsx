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

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get success message from location state if present
  const successMessage = location.state?.message;
  const messageType = location.state?.messageType;

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

      if (response.success) {
        // Successful login - navigate to dashboard
        navigate('/dashboard');
      }
    } catch (err) {
      const errorData = err.response?.data;
      
      // Check if password change is required
      if (errorData?.mustChangePassword) {
        // Redirect to change password page with xID
        navigate('/change-password', { state: { xID } });
      } else {
        setError(errorData?.message || 'Login failed. Please try again.');
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
        </form>
      </Card>
    </div>
  );
};
