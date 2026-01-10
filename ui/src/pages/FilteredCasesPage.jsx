/**
 * Filtered Cases Page
 * 
 * Displays filtered case lists for admin views:
 * - Pending Approvals (?approvalStatus=PENDING)
 * - Filed Cases (?status=FILED)
 * 
 * PR: Clickable Dashboard KPI Cards - Admin case list views
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import { CASE_STATUS } from '../utils/constants';
import api from '../services/api';
import './FilteredCasesPage.css';

export const FilteredCasesPage = () => {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { firmSlug } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });
  
  // Get filters from query params
  const status = searchParams.get('status');
  const approvalStatus = searchParams.get('approvalStatus');
  const page = parseInt(searchParams.get('page') || '1');

  useEffect(() => {
    loadCases();
  }, [status, approvalStatus, page]);

  const loadCases = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      let params = { page, limit: 20 };
      
      // Determine which endpoint to call
      if (status === CASE_STATUS.FILED) {
        // Admin filed cases
        endpoint = '/admin/cases/filed';
      } else if (approvalStatus === 'PENDING') {
        // Pending approvals (cases with status Reviewed or UNDER_REVIEW)
        endpoint = '/cases';
        params.status = CASE_STATUS.REVIEWED;
      } else {
        // Default: filtered cases
        endpoint = '/cases';
        if (status) params.status = status;
      }
      
      const response = await api.get(endpoint, { params });
      
      if (response.data.success) {
        setCases(response.data.data || []);
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      }
    } catch (error) {
      console.error('Failed to load cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseId) => {
    const slug = firmSlug || user?.firmSlug;
    navigate(slug ? `/${slug}/cases/${caseId}` : `/cases/${caseId}`);
  };
  
  // Get page title and description
  const getPageInfo = () => {
    if (status === CASE_STATUS.FILED) {
      return {
        title: 'Filed Cases',
        description: 'Archived and finalized cases (Admin only)',
      };
    }
    if (approvalStatus === 'PENDING') {
      return {
        title: 'Pending Approvals',
        description: 'Cases awaiting admin review and approval',
      };
    }
    return {
      title: 'Cases',
      description: 'Filtered case list',
    };
  };
  
  const pageInfo = getPageInfo();
  
  // Check admin access
  if (!isAdmin) {
    return (
      <Layout>
        <div className="filtered-cases">
          <Card>
            <p className="text-secondary">Access denied. Admin privileges required.</p>
          </Card>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <Loading message="Loading cases..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="filtered-cases">
        <div className="filtered-cases__header">
          <h1>{pageInfo.title}</h1>
          <p className="text-secondary">{pageInfo.description}</p>
        </div>

        <div className="filtered-cases__info">
          <span className="filtered-cases__count">
            Total: {pagination.total} case{pagination.total !== 1 ? 's' : ''}
          </span>
          <span className="filtered-cases__page">
            Page {pagination.page} of {pagination.pages}
          </span>
        </div>

        <Card>
          {cases.length === 0 ? (
            <div className="filtered-cases__empty">
              <p className="text-secondary">No cases found</p>
            </div>
          ) : (
            <table className="neo-table">
              <thead>
                <tr>
                  <th>Case ID</th>
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
                  <tr key={caseItem._id || caseItem.caseId} onClick={() => handleCaseClick(caseItem.caseId)}>
                    <td>{caseItem.caseId}</td>
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
        
        {pagination.pages > 1 && (
          <div className="filtered-cases__pagination">
            <button 
              className="btn btn--secondary"
              disabled={pagination.page === 1}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.set('page', String(pagination.page - 1));
                navigate(`?${params.toString()}`);
              }}
            >
              Previous
            </button>
            <span className="filtered-cases__pagination-info">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button 
              className="btn btn--secondary"
              disabled={pagination.page === pagination.pages}
              onClick={() => {
                const params = new URLSearchParams(searchParams);
                params.set('page', String(pagination.page + 1));
                navigate(`?${params.toString()}`);
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};
