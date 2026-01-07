/**
 * Change Password Page
 * Dedicated page for users who must change their password
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { authService } from '../services/authService';
import { validatePassword } from '../utils/validators';
import './ChangePasswordPage.css';

export const ChangePasswordPage = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  
  // Get xID from location state (passed during redirect from login)
  const xID = location.state?.xID;

  // Redirect to login if xID is missing
  React.useEffect(() => {
    if (!xID) {
      navigate('/login', {
        state: {
          message: 'Session expired. Please log in again.',
          messageType: 'warning'
        }
      });
    }
  }, [xID, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!currentPassword) {
      setError('Please enter your current password');
      return;
    }

    if (!validatePassword(newPassword)) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return;
    }

    setLoading(true);

    try {
      // Call change password endpoint with xID
      const response = await authService.changePasswordWithXID(xID, currentPassword, newPassword);

      if (response.success) {
        // Redirect to login with success message in state
        navigate('/login', { 
          state: { 
            message: 'Password changed successfully! Please log in with your new password.',
            messageType: 'success'
          }
        });
      } else {
        setError(response.message || 'Failed to change password');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-page">
      <Card className="change-password-card">
        <div className="change-password-header">
          <h1>Change Password</h1>
          <p className="text-secondary">You must change your password to continue</p>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            placeholder="Enter current password"
            autoFocus
          />

          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="Enter new password (min 8 characters)"
          />

          <Input
            label="Confirm New Password"
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
};
