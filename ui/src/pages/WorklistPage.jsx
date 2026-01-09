/**
 * Worklist Page
 * 
 * Shows cases assigned to the current user, with optional filtering by status.
 * - Default view: Only OPEN cases (My Worklist)
 * - With ?status=PENDING,ON_HOLD: Shows pending cases
 * 
 * This is the canonical "My Worklist" view.
 * 
 * PR: Case Lifecycle - Fixed to show only OPEN status cases
 * PR: Clickable Dashboard KPI Cards - Added support for status query params
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { worklistService } from '../services/worklistService';
import { CASE_STATUS } from '../utils/constants';
import api from '../services/api';
import './WorklistPage.css';

export const WorklistPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  
  // Get status filter from query params
  const statusParam = searchParams.get('status');
  const isPendingView = statusParam && (statusParam.includes('PENDING') || statusParam.includes('PENDED') || statusParam.includes('ON_HOLD'));

  useEffect(() => {
    loadWorklist();
  }, [statusParam]);

  const loadWorklist = async () => {
    setLoading(true);
    try {
      if (isPendingView) {
        // Load pending cases
        const response = await api.get('/cases/my-pending');
        if (response.data.success) {
          setCases(response.data.data || []);
        }
      } else {
        // Load open cases (default worklist)
        // PR: Hard Cutover to xID - Removed email parameter, uses auth token
        const response = await worklistService.getEmployeeWorklist();
        
        if (response.success) {
          // Worklist only contains OPEN cases (backend already filters)
          setCases(response.data || []);
        }
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
  
  // Get page title and description
  const getPageInfo = () => {
    if (isPendingView) {
      return {
        title: 'My Pending Cases',
        description: 'Cases temporarily on hold (status = PENDED)',
      };
    }
    return {
      title: 'My Worklist',
      description: 'Your open cases (status = OPEN). Pending cases appear in My Pending Cases.',
    };
  };
  
  const pageInfo = getPageInfo();

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
          <h1>{pageInfo.title}</h1>
          <p className="text-secondary">
            {pageInfo.description}
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
              <p className="text-secondary">
                {isPendingView ? 'No pending cases found' : 'No open cases assigned to you'}
              </p>
            </div>
          ) : (
            <table className="neo-table">
              <thead>
                <tr>
                  <th>Case Name</th>
                  <th>Category</th>
                  <th>Client ID</th>
                  <th>Status</th>
                  {isPendingView && <th>Pending Until</th>}
                  <th>Created</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((caseItem) => (
                  <tr key={caseItem._id} onClick={() => handleCaseClick(caseItem.caseId)}>
                    <td>{caseItem.caseName}</td>
                    <td>{caseItem.category}</td>
                    <td>{caseItem.clientId || 'N/A'}</td>
                    <td>
                      <Badge status={caseItem.status}>{caseItem.status}</Badge>
                    </td>
                    {isPendingView && (
                      <td>
                        {caseItem.pendingUntil 
                          ? new Date(caseItem.pendingUntil).toLocaleDateString() 
                          : 'N/A'}
                      </td>
                    )}
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
