/**
 * Firm Login Page
 * Firm-scoped login using path-based URL: /f/:firmSlug/login
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { validateXID, validatePassword } from '../utils/validators';
import { API_BASE_URL, USER_ROLES, ERROR_CODES, STORAGE_KEYS } from '../utils/constants';
import { buildStoredUser, isAccessTokenOnlyUser, mergeAuthUser } from '../utils/authUtils';
import api from '../services/api';
import { useToast } from '../hooks/useToast';
import './LoginPage.css';

export const FirmLoginPage = () => {
  const { firmSlug } = useParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [firmLoading, setFirmLoading] = useState(true);
  const [firmData, setFirmData] = useState(null);

  const { setAuthFromProfile } = useAuth();
  const { showSuccess } = useToast();
  const navigate = useNavigate();

  // Load firm metadata
  useEffect(() => {
    const loadFirmData = async () => {
      try {
        setFirmLoading(true);
        const response = await api.get(`/public/firms/${firmSlug}`);
        
        if (response.data.success) {
          const firm = response.data.data;
          
          // Check if firm is active
          if (firm.status !== 'ACTIVE') {
            setError('This firm is currently inactive. Please contact support.');
            setFirmData(null);
            localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
          } else {
            setFirmData(firm);
            localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, firmSlug);
          }
        }
      } catch (err) {
        console.error('Error loading firm:', err);
        setError('Firm not found. Please check your login URL.');
        setFirmData(null);
        localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
      } finally {
        setFirmLoading(false);
      }
    };

    if (firmSlug) {
      loadFirmData();
    }
  }, [firmSlug]);

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

    if (!firmData) {
      setError('Firm details are still loading. Please refresh the page.');
      return;
    }

    setLoading(true);

    try {
      // Login with firm context via API (not authService to include firmSlug)
      const response = await api.post('/auth/login', {
        xID: identifier,
        password: password,
        firmSlug: firmSlug, // Include firm context
      });

      if (response.data.success) {
        const {
          accessToken,
          refreshToken,
          data: userData,
          isSuperAdmin,
          refreshEnabled,
        } = response.data;
        const authUser = mergeAuthUser(userData, { isSuperAdmin, refreshEnabled });
        const accessTokenOnly = isAccessTokenOnlyUser(authUser);
        
        // Store tokens and user data in localStorage
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
        if (!accessTokenOnly && refreshToken) {
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        } else {
          localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        }
        localStorage.setItem(STORAGE_KEYS.X_ID, userData.xID || 'UNKNOWN');
        const storedUser = buildStoredUser(authUser, refreshEnabled);
        if (storedUser) {
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(storedUser));
        } else {
          localStorage.removeItem(STORAGE_KEYS.USER);
        }

        // Check if user is Superadmin (shouldn't happen via firm login, but check anyway)
        if (userData.role === USER_ROLES.SUPER_ADMIN) {
          localStorage.removeItem(STORAGE_KEYS.FIRM_SLUG);
          setAuthFromProfile(userData);
          showSuccess('Signed in successfully.');
          navigate('/superadmin');
        } else {
          // Regular users go to firm-scoped dashboard
          // Use firmSlug from backend response if available, fallback to URL firmSlug
          const userFirmSlug = userData.firmSlug || firmSlug;
          if (userFirmSlug) {
            localStorage.setItem(STORAGE_KEYS.FIRM_SLUG, userFirmSlug);
          }
          setAuthFromProfile(userData);
          showSuccess('Signed in successfully.');
          
          // Immediately navigate - do NOT poll profile or retry
          navigate(`/f/${userFirmSlug}/dashboard`);
        }
      }
    } catch (err) {
      const errorData = err.response?.data;
      
      if (errorData?.mustChangePassword) {
        // Redirect to change password page with identifier
        navigate('/change-password', { state: { xID: identifier } });
      } else if (errorData?.mustSetPassword || errorData?.code === ERROR_CODES.PASSWORD_SETUP_REQUIRED) {
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

  const handleGoogleLogin = () => {
    const url = `${API_BASE_URL}/auth/google${firmSlug ? `?firmSlug=${encodeURIComponent(firmSlug)}` : ''}`;
    window.location.href = url;
  };

  if (firmLoading) {
    return (
      <div className="login-page">
        <Card className="login-card">
          <Loading message="Loading firm information..." />
        </Card>
      </div>
    );
  }

  if (!firmData) {
    return (
      <div className="login-page">
        <Card className="login-card">
          <div className="login-header">
            <h1>Docketra</h1>
            <p className="text-secondary">Case Management System</p>
          </div>
          <div className="error-message" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: '#e53e3e', marginBottom: '1rem' }}>{error}</p>
            <p style={{ color: '#718096', fontSize: '0.875rem' }}>
              Please contact your administrator for the correct login URL.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="login-page">
      <Card className="login-card">
        <div className="login-header">
          <h1>{firmData.name}</h1>
          <p className="text-secondary">Login to Docketra</p>
          <p style={{ fontSize: '0.75rem', color: '#718096', marginTop: '0.5rem' }}>
            Firm ID: {firmData.firmId}
          </p>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

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
            Enter your user ID (e.g., X000001)
          </p>

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
          />

          <Button 
            type="submit" 
            fullWidth 
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div style={{ margin: '1rem 0', textAlign: 'center', color: '#A0AEC0', fontSize: '0.875rem' }}>
          <span>or</span>
        </div>

        <Button 
          type="button" 
          fullWidth 
          variant="secondary" 
          onClick={handleGoogleLogin}
          className="google-button"
        >
          Continue with Google
        </Button>

        <div className="login-footer">
          <Link to="/forgot-password" className="link">
            Forgot Password?
          </Link>
        </div>

        <div style={{ 
          marginTop: '1.5rem', 
          padding: '1rem', 
          backgroundColor: '#f7fafc', 
          borderRadius: '8px',
          fontSize: '0.875rem',
          color: '#718096',
          textAlign: 'center'
        }}>
          🔒 Secure firm-scoped login
        </div>
      </Card>
    </div>
  );
};
