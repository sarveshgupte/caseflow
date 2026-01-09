/**
 * Worklist Page
 * 
 * Shows only OPEN cases assigned to the current user.
 * This is the canonical "My Worklist" view.
 * 
 * PENDED cases do NOT appear here - they appear in "My Pending Cases" dashboard.
 * 
 * PR: Case Lifecycle - Fixed to show only OPEN status cases
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { worklistService } from '../services/worklistService';
import { CASE_STATUS } from '../utils/constants';
import './WorklistPage.css';

export const WorklistPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);

  useEffect(() => {
    loadWorklist();
  }, []);

  const loadWorklist = async () => {
    setLoading(true);
    try {
      const response = await worklistService.getEmployeeWorklist(user?.email);
      
      if (response.success) {
        // Worklist only contains OPEN cases (backend already filters)
        setCases(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load worklist:', error);
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
        <Loading message="Loading worklist..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="worklist">
        <div className="worklist__header">
          <h1>My Worklist</h1>
          <p className="text-secondary">
            Your open cases (status = OPEN). Pending cases appear in the Dashboard.
          </p>
        </div>

        <div className="worklist__filters">
          <span className="worklist__count">
            Total: {cases.length} case{cases.length !== 1 ? 's' : ''}
          </span>
        </div>

        <Card>
          {cases.length === 0 ? (
            <div className="worklist__empty">
              <p className="text-secondary">No open cases assigned to you</p>
            </div>
          ) : (
            <table className="neo-table">
              <thead>
                <tr>
                  <th>Case Name</th>
                  <th>Category</th>
                  <th>Client ID</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseItem) => (
                  <tr key={caseItem._id} onClick={() => handleCaseClick(caseItem.caseName)}>
                    <td>{caseItem.caseName}</td>
                    <td>{caseItem.category}</td>
                    <td>{caseItem.clientId || 'N/A'}</td>
                    <td>
                      <Badge status={caseItem.status}>{caseItem.status}</Badge>
                    </td>
                    <td>{new Date(caseItem.createdAt).toLocaleDateString()}</td>
                    <td>{new Date(caseItem.updatedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </Layout>
  );
};
