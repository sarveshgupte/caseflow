/**
 * Dashboard Page
 * 
 * Shows:
 * - My Open Cases: Cases assigned to me with status = OPEN (matches My Worklist)
 * - My Pending Cases: Cases assigned to me with status = PENDED (does not appear in worklist)
 * - Cases Created by Me (Unassigned): Cases I created that are still in global worklist
 * - Admin views: All cases, pending approvals, filed cases
 * 
 * PR: Case Lifecycle - Fixed to use correct queries that match worklist
 * PR: Clickable Dashboard KPI Cards - All cards are clickable and navigate to filtered lists
 * PR: Fix Case Visibility - Added unassigned created cases metric
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { caseService } from '../services/caseService';
import { worklistService } from '../services/worklistService';
import { adminService } from '../services/adminService';
import api from '../services/api';
import './DashboardPage.css';

export const DashboardPage = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    myOpenCases: 0,
    myPendingCases: 0,
    myResolvedCases: 0,
    myUnassignedCreatedCases: 0,
    adminPendingApprovals: 0,
    adminFiledCases: 0,
    adminResolvedCases: 0,
  });
  const [recentCases, setRecentCases] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Get My Open Cases count - CANONICAL QUERY (matches My Worklist exactly)
      // Query: assignedToXID = userXID AND status = OPEN
      // PR: Hard Cutover to xID - Removed email parameter, uses auth token
      const worklistResponse = await worklistService.getEmployeeWorklist();
      
      if (worklistResponse.success) {
        const openCases = worklistResponse.data || [];
        
        // My Open Cases = all cases from worklist (which only shows OPEN cases)
        setStats((prev) => ({
          ...prev,
          myOpenCases: openCases.length,
        }));
        
        // Set recent cases (first 5 from worklist)
        setRecentCases(openCases.slice(0, 5));
      }
      
      // Get My Pending Cases count
      // Query: assignedTo = userXID AND status = PENDED AND pendedByXID = userXID
      try {
        const pendingResponse = await api.get('/cases/my-pending');
        if (pendingResponse.data.success) {
          const pendingCases = pendingResponse.data.data || [];
          setStats((prev) => ({
            ...prev,
            myPendingCases: pendingCases.length,
          }));
        }
      } catch (error) {
        console.error('Failed to load pending cases:', error);
        // Non-critical, continue
      }
      
      // Get My Resolved Cases count
      try {
        const resolvedResponse = await caseService.getMyResolvedCases();
        if (resolvedResponse.success) {
          const resolvedCases = resolvedResponse.data || [];
          setStats((prev) => ({
            ...prev,
            myResolvedCases: resolvedCases.length,
          }));
        }
      } catch (error) {
        console.error('Failed to load resolved cases:', error);
        // Non-critical, continue
      }
      
      // Get My Unassigned Created Cases count
      // PR: Fix Case Visibility - New dashboard metric for created-but-unassigned cases
      try {
        const unassignedCreatedResponse = await caseService.getMyUnassignedCreatedCases();
        if (unassignedCreatedResponse.success) {
          const unassignedCreatedCases = unassignedCreatedResponse.data || [];
          setStats((prev) => ({
            ...prev,
            myUnassignedCreatedCases: unassignedCreatedCases.length,
          }));
        }
      } catch (error) {
        console.error('Failed to load unassigned created cases:', error);
        // Non-critical, continue
      }
      
      // If admin, get pending approvals, filed cases, and resolved cases
      if (isAdmin) {
        try {
          const approvalsResponse = await adminService.getPendingApprovals();
          if (approvalsResponse.success) {
            setStats((prev) => ({
              ...prev,
              adminPendingApprovals: approvalsResponse.data?.length || 0,
            }));
          }
        } catch (error) {
          console.error('Failed to load pending approvals:', error);
        }
        
        try {
          const filedResponse = await api.get('/admin/cases/filed');
          if (filedResponse.data.success) {
            setStats((prev) => ({
              ...prev,
              adminFiledCases: filedResponse.data.pagination?.total || 0,
            }));
          }
        } catch (error) {
          console.error('Failed to load filed cases:', error);
        }
        
        try {
          const adminResolvedResponse = await adminService.getAllResolvedCases();
          if (adminResolvedResponse.success) {
            setStats((prev) => ({
              ...prev,
              adminResolvedCases: adminResolvedResponse.pagination?.total || 0,
            }));
          }
        } catch (error) {
          console.error('Failed to load admin resolved cases:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseId) => {
    navigate(`/cases/${caseId}`);
  };
  
  // Navigation handlers for KPI cards
  const handleMyOpenCasesClick = () => {
    navigate('/my-worklist?status=OPEN');
  };
  
  const handleMyPendingCasesClick = () => {
    navigate('/my-worklist?status=PENDED');
  };
  
  const handleMyResolvedCasesClick = () => {
    navigate('/my-worklist?status=RESOLVED');
  };
  
  const handleMyUnassignedCreatedCasesClick = () => {
    navigate('/worklists/global?createdBy=me&status=UNASSIGNED');
  };
  
  const handlePendingApprovalsClick = () => {
    navigate('/cases?approvalStatus=PENDING');
  };
  
  const handleFiledCasesClick = () => {
    navigate('/cases?status=FILED');
  };
  
  const handleAdminResolvedCasesClick = () => {
    navigate('/cases?status=RESOLVED');
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading dashboard..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="dashboard">
        <div className="dashboard__header">
          <h1>Dashboard</h1>
          <p className="text-secondary">Welcome back, {user?.name || user?.xID}</p>
        </div>

        <div className="dashboard__stats">
          <Card 
            className="dashboard__stat-card dashboard__stat-card--clickable" 
            onClick={handleMyOpenCasesClick}
          >
            <div className="dashboard__stat-value">{stats.myOpenCases}</div>
            <div className="dashboard__stat-label">My Open Cases</div>
            <div className="dashboard__stat-description text-secondary">
              Cases in My Worklist
            </div>
          </Card>

          <Card 
            className="dashboard__stat-card dashboard__stat-card--clickable" 
            onClick={handleMyPendingCasesClick}
          >
            <div className="dashboard__stat-value">{stats.myPendingCases}</div>
            <div className="dashboard__stat-label">My Pending Cases</div>
            <div className="dashboard__stat-description text-secondary">
              Temporarily on hold
            </div>
          </Card>

          <Card 
            className="dashboard__stat-card dashboard__stat-card--clickable" 
            onClick={handleMyResolvedCasesClick}
          >
            <div className="dashboard__stat-value">{stats.myResolvedCases}</div>
            <div className="dashboard__stat-label">My Resolved Cases</div>
            <div className="dashboard__stat-description text-secondary">
              Successfully completed
            </div>
          </Card>

          <Card 
            className="dashboard__stat-card dashboard__stat-card--clickable" 
            onClick={handleMyUnassignedCreatedCasesClick}
          >
            <div className="dashboard__stat-value">{stats.myUnassignedCreatedCases}</div>
            <div className="dashboard__stat-label">Cases Created by Me (Unassigned)</div>
            <div className="dashboard__stat-description text-secondary">
              In Global Worklist
            </div>
          </Card>

          {isAdmin && (
            <>
              <Card 
                className="dashboard__stat-card dashboard__stat-card--admin dashboard__stat-card--clickable" 
                onClick={handlePendingApprovalsClick}
              >
                <div className="dashboard__stat-value">{stats.adminPendingApprovals}</div>
                <div className="dashboard__stat-label">Pending Approvals</div>
                <div className="dashboard__stat-description text-secondary">
                  Awaiting review
                </div>
              </Card>
              
              <Card 
                className="dashboard__stat-card dashboard__stat-card--admin dashboard__stat-card--clickable" 
                onClick={handleFiledCasesClick}
              >
                <div className="dashboard__stat-value">{stats.adminFiledCases}</div>
                <div className="dashboard__stat-label">Filed Cases</div>
                <div className="dashboard__stat-description text-secondary">
                  Archived cases
                </div>
              </Card>
              
              <Card 
                className="dashboard__stat-card dashboard__stat-card--admin dashboard__stat-card--clickable" 
                onClick={handleAdminResolvedCasesClick}
              >
                <div className="dashboard__stat-value">{stats.adminResolvedCases}</div>
                <div className="dashboard__stat-label">All Resolved Cases</div>
                <div className="dashboard__stat-description text-secondary">
                  All completed cases
                </div>
              </Card>
            </>
          )}
        </div>

        {recentCases.length > 0 && (
          <div className="dashboard__section">
            <h2 className="dashboard__section-title">Recently Accessed Cases</h2>
            <Card>
              <table className="neo-table">
                <thead>
                  <tr>
                    <th>Case Name</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentCases.map((caseItem) => (
                    <tr key={caseItem._id} onClick={() => handleCaseClick(caseItem.caseId)}>
                      <td>{caseItem.caseName}</td>
                      <td>{caseItem.category}</td>
                      <td>
                        <Badge status={caseItem.status}>{caseItem.status}</Badge>
                      </td>
                      <td>{new Date(caseItem.updatedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};
