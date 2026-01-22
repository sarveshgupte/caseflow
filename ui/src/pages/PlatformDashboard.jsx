/**
 * Platform Dashboard
 * SuperAdmin view of platform-level metrics
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { superadminService } from '../services/superadminService';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { useToast } from '../hooks/useToast';
import { STORAGE_KEYS, USER_ROLES } from '../utils/constants';
import './PlatformDashboard.css';

export const PlatformDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const emptyStats = {
    totalFirms: 0,
    activeFirms: 0,
    inactiveFirms: 0,
    totalClients: 0,
    totalUsers: 0,
  };
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(emptyStats);
  const isFetchingRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const hasShownErrorRef = useRef(false);

  // Verify user is Superadmin
  useEffect(() => {
    if (!user) {
      return;
    }
    if (user.role !== USER_ROLES.SUPER_ADMIN) {
      const fallbackSlug = user.firmSlug || localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);
      navigate(fallbackSlug ? `/f/${fallbackSlug}/dashboard` : '/login', { replace: true });
    }
  }, [user, navigate]);

  // Load platform stats once per dashboard load
  useEffect(() => {
    if (user?.role === USER_ROLES.SUPER_ADMIN && !hasLoadedRef.current && !isFetchingRef.current) {
      loadStats();
    }
    if (user && user.role !== USER_ROLES.SUPER_ADMIN) {
      // Release the loading state on non-superadmin redirects so guarded stats fetching can't block the UI.
      setLoading(false);
    }
  }, [user?.role]);

  const loadStats = async () => {
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;
    try {
      setLoading(true);
      const response = await superadminService.getPlatformStats();
      // HTTP 304 means cached data is still valid - keep current state
      if (response?.status === 304) {
        // Do nothing - keep existing stats
      } else if (response?.success) {
        setStats(response.data || emptyStats);
      } else if (response?.degraded) {
        setStats(response?.data || emptyStats);
      } else if (!hasShownErrorRef.current) {
        toast.error('Failed to load platform statistics');
        hasShownErrorRef.current = true;
      }
    } catch (error) {
      // Never block UI on stats fetch failure - use empty stats
      setStats(emptyStats);
      if (!hasShownErrorRef.current) {
        toast.error('Failed to load platform statistics');
        hasShownErrorRef.current = true;
      }
      console.error('Error loading platform stats:', error);
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <Loading message="Loading platform data..." />
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="platform-dashboard">
        <div className="platform-dashboard__header">
          <h1>Platform Overview</h1>
          <p className="platform-dashboard__subtitle">
            Manage firms on the Docketra platform. Operational work is handled within firms.
          </p>
        </div>

        <div className="platform-dashboard__metrics">
          <Card className="platform-metric-card" onClick={() => navigate('/superadmin/firms')}>
            <div className="platform-metric-card__icon">🏢</div>
            <div className="platform-metric-card__value">{stats.totalFirms}</div>
            <div className="platform-metric-card__label">Total Firms</div>
            <div className="platform-metric-card__subtext">
              {stats.totalFirms === 0 
                ? 'No firms exist yet. This is expected.' 
                : `${stats.activeFirms} Active • ${stats.inactiveFirms} Inactive`}
            </div>
          </Card>

          <Card className="platform-metric-card">
            <div className="platform-metric-card__icon">👥</div>
            <div className="platform-metric-card__value">{stats.totalClients}</div>
            <div className="platform-metric-card__label">Total Clients</div>
            <div className="platform-metric-card__subtext">
              {stats.totalClients === 0 
                ? 'No clients yet. Create a firm to begin.' 
                : 'Across all firms'}
            </div>
          </Card>

          <Card className="platform-metric-card">
            <div className="platform-metric-card__icon">👤</div>
            <div className="platform-metric-card__value">{stats.totalUsers}</div>
            <div className="platform-metric-card__label">Total Users</div>
            <div className="platform-metric-card__subtext">
              {stats.totalUsers === 0 
                ? 'No users yet. Create a firm to begin.' 
                : 'Across all firms'}
            </div>
          </Card>
        </div>

        <div className="platform-dashboard__cta">
          <Card className="platform-cta-card">
            <h2>Manage Firms</h2>
            <p>Create new firms, activate or deactivate existing ones, and manage firm administrators.</p>
            <button 
              className="neo-button neo-button--primary"
              onClick={() => navigate('/superadmin/firms')}
            >
              Go to Firms Management
            </button>
          </Card>
        </div>
      </div>
    </SuperAdminLayout>
  );
};
