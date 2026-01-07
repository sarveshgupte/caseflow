/**
 * Worklist Page
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
  const [filteredCases, setFilteredCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadWorklist();
  }, []);

  useEffect(() => {
    filterCases();
  }, [statusFilter, cases]);

  const loadWorklist = async () => {
    setLoading(true);
    try {
      const response = await worklistService.getEmployeeWorklist(user?.email);
      
      if (response.success) {
        setCases(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load worklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCases = () => {
    if (!statusFilter) {
      setFilteredCases(cases);
    } else {
      setFilteredCases(cases.filter((c) => c.status === statusFilter));
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
          <p className="text-secondary">Cases assigned to you</p>
        </div>

        <div className="worklist__filters">
          <Button
            variant={!statusFilter ? 'primary' : 'default'}
            onClick={() => setStatusFilter('')}
          >
            All ({cases.length})
          </Button>
          <Button
            variant={statusFilter === CASE_STATUS.OPEN ? 'primary' : 'default'}
            onClick={() => setStatusFilter(CASE_STATUS.OPEN)}
          >
            Open ({cases.filter((c) => c.status === CASE_STATUS.OPEN).length})
          </Button>
          <Button
            variant={statusFilter === CASE_STATUS.PENDING ? 'primary' : 'default'}
            onClick={() => setStatusFilter(CASE_STATUS.PENDING)}
          >
            Pending ({cases.filter((c) => c.status === CASE_STATUS.PENDING).length})
          </Button>
          <Button
            variant={statusFilter === CASE_STATUS.CLOSED ? 'primary' : 'default'}
            onClick={() => setStatusFilter(CASE_STATUS.CLOSED)}
          >
            Closed ({cases.filter((c) => c.status === CASE_STATUS.CLOSED).length})
          </Button>
          <Button
            variant={statusFilter === CASE_STATUS.FILED ? 'primary' : 'default'}
            onClick={() => setStatusFilter(CASE_STATUS.FILED)}
          >
            Filed ({cases.filter((c) => c.status === CASE_STATUS.FILED).length})
          </Button>
        </div>

        <Card>
          {filteredCases.length === 0 ? (
            <div className="worklist__empty">
              <p className="text-secondary">No cases found</p>
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
                {filteredCases.map((caseItem) => (
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
