/**
 * Platform Dashboard
 * SuperAdmin view of platform-level metrics
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { superadminService } from '../services/superadminService';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Loading } from '../components/common/Loading';
import { useToast } from '../hooks/useToast';
import { USER_ROLES } from '../utils/constants';
import './PlatformDashboard.css';

export const PlatformDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalFirms: 0,
    activeFirms: 0,
    inactiveFirms: 0,
    totalClients: 0,
    totalUsers: 0,
  });

  // Verify user is Superadmin
  useEffect(() => {
    if (!user || user.role !== USER_ROLES.SUPER_ADMIN) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Load platform stats
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await superadminService.getPlatformStats();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      toast.error('Failed to load platform statistics');
      console.error('Error loading platform stats:', error);
    } finally {
      setLoading(false);
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
              {stats.activeFirms} Active • {stats.inactiveFirms} Inactive
            </div>
          </Card>

          <Card className="platform-metric-card">
            <div className="platform-metric-card__icon">👥</div>
            <div className="platform-metric-card__value">{stats.totalClients}</div>
            <div className="platform-metric-card__label">Total Clients</div>
            <div className="platform-metric-card__subtext">
              Across all firms
            </div>
          </Card>

          <Card className="platform-metric-card">
            <div className="platform-metric-card__icon">👤</div>
            <div className="platform-metric-card__value">{stats.totalUsers}</div>
            <div className="platform-metric-card__label">Total Users</div>
            <div className="platform-metric-card__subtext">
              Across all firms
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
