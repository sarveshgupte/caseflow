/**
 * Reports Dashboard Page
 * MIS Dashboard with metric cards
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../../components/common/Layout';
import { MetricCard } from '../../components/reports/MetricCard';
import { Loading } from '../../components/common/Loading';
import { useAuth } from '../../hooks/useAuth';
import { reportsService } from '../../services/reports.service';
import './ReportsDashboard.css';

export const ReportsDashboard = () => {
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [pendingReport, setPendingReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Load case metrics
      const metricsResponse = await reportsService.getCaseMetrics();
      if (metricsResponse.data.success) {
        setMetrics(metricsResponse.data.data);
      }

      // Load pending cases report
      const pendingResponse = await reportsService.getPendingCases();
      if (pendingResponse.data.success) {
        setPendingReport(pendingResponse.data.data);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      if (err.response?.status === 403) {
        setError('You do not have permission to access reports');
      } else {
        setError('Report data could not be loaded. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetailedReports = () => {
    const slug = firmSlug || user?.firmSlug;
    navigate(slug ? `/${slug}/admin/reports/detailed` : '/admin/reports/detailed');
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading reports dashboard..." />
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="reports-dashboard">
          <div className="reports-dashboard__error">
            <h2>Access Denied</h2>
            <p>{error}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="reports-dashboard">
        <div className="reports-dashboard__header">
          <h1>Reports & MIS Dashboard</h1>
          <p className="text-secondary">Management information system - Read-only view</p>
        </div>

        <div className="reports-dashboard__grid">
          {/* Total Cases Card */}
          <MetricCard
            title="Total Cases"
            value={metrics?.totalCases || 0}
            subtitle={`Open: ${metrics?.byStatus?.Open || 0} | Pending: ${metrics?.byStatus?.Pending || 0} | Closed: ${metrics?.byStatus?.Closed || 0}`}
            onClick={handleViewDetailedReports}
          />

          {/* Pending Cases Card */}
          <MetricCard
            title="Pending Cases"
            value={pendingReport?.totalPending || 0}
            subtitle={`Critical: ${pendingReport?.byAgeing?.['30+ days'] || 0} overdue`}
            warning={pendingReport?.byAgeing?.['30+ days'] > 0}
            onClick={handleViewDetailedReports}
          />

          {/* Top Categories Card */}
          <div className="reports-dashboard__card">
            <h3>Top Categories</h3>
            {metrics?.byCategory && Object.keys(metrics.byCategory).length > 0 ? (
              <table className="reports-dashboard__table">
                <tbody>
                  {Object.entries(metrics.byCategory)
                    .slice(0, 5)
                    .map(([category, count]) => (
                      <tr key={category}>
                        <td>{category}</td>
                        <td className="reports-dashboard__count">{count}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p className="text-secondary">No data available</p>
            )}
          </div>

          {/* Top Clients Card */}
          <div className="reports-dashboard__card">
            <h3>Top Clients</h3>
            {metrics?.byClient && metrics.byClient.length > 0 ? (
              <table className="reports-dashboard__table">
                <tbody>
                  {metrics.byClient.slice(0, 5).map((client) => (
                    <tr key={client.clientId}>
                      <td>{client.clientName}</td>
                      <td className="reports-dashboard__count">{client.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-secondary">No data available</p>
            )}
          </div>

          {/* Ageing Breakdown Card */}
          <div className="reports-dashboard__card">
            <h3>Pending Cases Ageing</h3>
            {pendingReport?.byAgeing ? (
              <table className="reports-dashboard__table">
                <tbody>
                  <tr>
                    <td>0-7 days</td>
                    <td className="reports-dashboard__count">{pendingReport.byAgeing['0-7 days'] || 0}</td>
                  </tr>
                  <tr>
                    <td>8-30 days</td>
                    <td className="reports-dashboard__count">{pendingReport.byAgeing['8-30 days'] || 0}</td>
                  </tr>
                  <tr>
                    <td>30+ days</td>
                    <td className="reports-dashboard__count reports-dashboard__count--warning">
                      {pendingReport.byAgeing['30+ days'] || 0}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-secondary">No data available</p>
            )}
          </div>

          {/* Top Employees Card */}
          <div className="reports-dashboard__card">
            <h3>Top Employees by Cases</h3>
            {metrics?.byEmployee && metrics.byEmployee.length > 0 ? (
              <table className="reports-dashboard__table">
                <tbody>
                  {metrics.byEmployee.slice(0, 5).map((employee) => (
                    <tr key={employee.email}>
                      <td>{employee.name}</td>
                      <td className="reports-dashboard__count">{employee.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-secondary">No data available</p>
            )}
          </div>
        </div>

        <div className="reports-dashboard__actions">
          <button className="neo-button neo-button--primary" onClick={handleViewDetailedReports}>
            View Detailed Reports
          </button>
        </div>
      </div>
    </Layout>
  );
};
