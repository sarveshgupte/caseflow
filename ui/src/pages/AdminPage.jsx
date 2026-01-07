/**
 * Admin Page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { adminService } from '../services/adminService';
import './AdminPage.css';

export const AdminPage = () => {
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('approvals');
  const [pendingCases, setPendingCases] = useState([]);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const response = await adminService.getPendingApprovals();
      
      if (response.success) {
        setPendingCases(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseId) => {
    navigate(`/cases/${caseId}`);
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading admin panel..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="admin">
        <div className="admin__header">
          <h1>Admin Panel</h1>
          <p className="text-secondary">Manage users and approvals</p>
        </div>

        <div className="admin__tabs">
          <Button
            variant={activeTab === 'approvals' ? 'primary' : 'default'}
            onClick={() => setActiveTab('approvals')}
          >
            Pending Approvals ({pendingCases.length})
          </Button>
          <Button
            variant={activeTab === 'users' ? 'primary' : 'default'}
            onClick={() => setActiveTab('users')}
          >
            User Management
          </Button>
        </div>

        {activeTab === 'approvals' && (
          <Card>
            <h2 className="neo-section__header">Pending Client Approvals</h2>
            
            {pendingCases.length === 0 ? (
              <div className="admin__empty">
                <p className="text-secondary">No pending approvals</p>
              </div>
            ) : (
              <table className="neo-table">
                <thead>
                  <tr>
                    <th>Case Name</th>
                    <th>Category</th>
                    <th>Client ID</th>
                    <th>Created</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingCases.map((caseItem) => (
                    <tr key={caseItem._id} onClick={() => handleCaseClick(caseItem.caseName)}>
                      <td>{caseItem.caseName}</td>
                      <td>{caseItem.category}</td>
                      <td>{caseItem.clientId || 'N/A'}</td>
                      <td>{new Date(caseItem.createdAt).toLocaleDateString()}</td>
                      <td>
                        <Badge status={caseItem.status}>{caseItem.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {activeTab === 'users' && (
          <Card>
            <h2 className="neo-section__header">User Management</h2>
            <div className="admin__empty">
              <p className="text-secondary">User management features coming soon</p>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
};
