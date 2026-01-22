/**
 * Cases Page
 * 
 * Full list of cases with role-based visibility:
 * - Firm Admin: All firm cases
 * - Regular User: Only assigned cases
 * 
 * PR 177: Core Case Management - Firm Cases List
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { caseService } from '../services/caseService';
import { worklistService } from '../services/worklistService';
import { CASE_STATUS } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import './CasesPage.css';

export const CasesPage = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const { firmSlug } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [filteredCases, setFilteredCases] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState(null);

  // Helper to normalize case identifiers
  const normalizeCases = (cases = []) =>
    cases.map(c => ({
      ...c,
      caseId: c.caseId || c._id
    }));

  useEffect(() => {
    if (user) {
      loadCases();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    // Apply client-side filtering
    if (statusFilter === 'ALL') {
      setFilteredCases(cases);
    } else {
      setFilteredCases(cases.filter(c => c.status === statusFilter));
    }
  }, [statusFilter, cases]);

  const loadCases = async () => {
    setLoading(true);
    setError(null);
    try {
      let casesData = [];
      
      if (isAdmin) {
        // Admin: Get all firm cases
        const response = await caseService.getCases();
        if (response.success) {
          casesData = response.data || [];
        }
      } else {
        // Regular user: Get assigned cases from worklist
        const response = await worklistService.getEmployeeWorklist();
        if (response.success) {
          casesData = response.data || [];
        }
      }
      
      setCases(normalizeCases(casesData));
    } catch (err) {
      console.error('Failed to load cases:', err);
      setError(err);
      // Never crash - show empty state instead
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseId) => {
    navigate(`/f/${firmSlug}/cases/${caseId}`);
  };
  
  const handleCreateCase = () => {
    navigate(`/f/${firmSlug}/cases/create`);
  };

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading cases…" />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="cases-page">
        <div className="cases-page__header">
          <h1>Cases</h1>
          <p className="text-secondary">
            {isAdmin ? 'All cases in your firm' : 'Cases assigned to you'}
          </p>
        </div>

        {/* Filters */}
        <div className="cases-page__filters">
          <div className="cases-page__filter-group">
            <label className="cases-page__filter-label">Status:</label>
            <select 
              className="cases-page__filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value={CASE_STATUS.OPEN}>OPEN</option>
              <option value={CASE_STATUS.RESOLVED}>RESOLVED</option>
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="cases-page__error" role="alert">
            <p>⚠️ Failed to load cases. Please try refreshing the page.</p>
          </div>
        )}

        {/* Cases Table */}
        <Card>
          {filteredCases.length === 0 ? (
            <div className="cases-page__empty">
              <div className="cases-page__empty-icon" role="img" aria-label="Document icon">
                📋
              </div>
              {isAdmin ? (
                <>
                  <h3 className="cases-page__empty-title">No cases yet</h3>
                  <p className="cases-page__empty-description text-secondary">
                    Your firm has no cases yet. Create the first one to get started.
                  </p>
                  <button 
                    className="neo-btn neo-btn--primary cases-page__empty-cta"
                    onClick={handleCreateCase}
                  >
                    Create Case
                  </button>
                </>
              ) : (
                <>
                  <h3 className="cases-page__empty-title">No cases assigned to you</h3>
                  <p className="cases-page__empty-description text-secondary">
                    You currently have no assigned cases.
                  </p>
                </>
              )}
            </div>
          ) : (
            <table className="neo-table">
              <thead>
                <tr>
                  <th>Case Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredCases.map((caseItem) => (
                  <tr 
                    key={caseItem.caseId} 
                    onClick={() => handleCaseClick(caseItem.caseId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCaseClick(caseItem.caseId);
                    }}
                    tabIndex={0}
                  >
                    <td>{caseItem.caseName}</td>
                    <td>{caseItem.category}</td>
                    <td>
                      <Badge status={caseItem.status}>{caseItem.status}</Badge>
                    </td>
                    <td>
                      {caseItem.assignedToName || caseItem.assignedTo || 'Unassigned'}
                    </td>
                    <td>{formatDate(caseItem.updatedAt)}</td>
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
