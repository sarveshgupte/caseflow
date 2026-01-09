/**
 * Global Worklist Page
 * Displays unassigned cases that can be pulled by users
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Loading } from '../components/common/Loading';
import { useAuth } from '../hooks/useAuth';
import { worklistService } from '../services/worklistService';
import './GlobalWorklistPage.css';

export const GlobalWorklistPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [filters, setFilters] = useState({
    clientId: '',
    category: '',
    createdAtFrom: '',
    createdAtTo: '',
    slaStatus: '',
    sortBy: 'slaDueDate',
    sortOrder: 'asc',
    page: 1,
    limit: 20,
  });
  const [pagination, setPagination] = useState(null);
  const [pullingCase, setPullingCase] = useState(null);
  const [selectedCases, setSelectedCases] = useState([]);
  const [bulkPulling, setBulkPulling] = useState(false);

  useEffect(() => {
    loadGlobalWorklist();
  }, [filters]);

  const loadGlobalWorklist = async () => {
    setLoading(true);
    try {
      const response = await worklistService.getGlobalWorklist(filters);
      
      if (response.success) {
        setCases(response.data || []);
        setPagination(response.pagination);
        setSelectedCases([]); // Clear selection when reloading
      }
    } catch (error) {
      console.error('Failed to load global worklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCase = (caseId) => {
    setSelectedCases(prev => 
      prev.includes(caseId) 
        ? prev.filter(id => id !== caseId)
        : [...prev, caseId]
    );
  };

  const handleSelectAll = () => {
    if (selectedCases.length === cases.length) {
      setSelectedCases([]);
    } else {
      setSelectedCases(cases.map(c => c.caseId));
    }
  };

  const handleBulkPull = async () => {
    if (!user?.xID) {
      alert('Authenticated userXID is required to pull cases. Please log in again.');
      return;
    }

    if (selectedCases.length === 0) {
      alert('Please select at least one case to pull.');
      return;
    }

    if (!confirm(`Pull ${selectedCases.length} selected case(s)? This will assign them to you.`)) {
      return;
    }

    setBulkPulling(true);
    try {
      // Use unified pullCases endpoint for bulk operations
      const response = await worklistService.pullCases(selectedCases);
      
      if (response.success) {
        const message = response.pulled < response.requested
          ? `${response.pulled} of ${response.requested} cases pulled. Some were already assigned.`
          : `All ${response.pulled} cases pulled successfully!`;
        alert(message);
        // Refresh the worklist
        loadGlobalWorklist();
      }
    } catch (error) {
      alert(`Failed to pull cases: ${error.response?.data?.message || error.message}`);
    } finally {
      setBulkPulling(false);
    }
  };

  const handlePullCase = async (caseId) => {
    if (!user?.xID) {
      alert('Authenticated userXID is required to pull cases. Please log in again.');
      return;
    }

    if (!confirm(`Pull case ${caseId}? This will assign it to you.`)) {
      return;
    }

    setPullingCase(caseId);
    try {
      // Use unified pullCases endpoint for single case (pass as array)
      const response = await worklistService.pullCases([caseId]);
      
      if (response.success) {
        alert('Case pulled successfully!');
        // Refresh the worklist
        loadGlobalWorklist();
      }
    } catch (error) {
      if (error.response?.status === 409) {
        alert('Case is no longer available (already assigned)');
        loadGlobalWorklist(); // Refresh to remove it
      } else {
        alert(`Failed to pull case: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setPullingCase(null);
    }
  };

  const handleFilterChange = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
      page: 1, // Reset to first page when filters change
    }));
  };

  const handleSort = (field) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getSLAStatusClass = (daysRemaining) => {
    if (daysRemaining === null) return '';
    if (daysRemaining < 0) return 'sla-overdue';
    if (daysRemaining <= 2) return 'sla-due-soon';
    return 'sla-on-track';
  };

  const getSortIcon = (field) => {
    if (filters.sortBy !== field) return '⇅';
    return filters.sortOrder === 'asc' ? '↑' : '↓';
  };

  if (loading && cases.length === 0) {
    return (
      <Layout>
        <Loading message="Loading global worklist..." />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="global-worklist">
        <div className="global-worklist__header">
          <h1>Global Worklist</h1>
          <p className="text-secondary">Pull cases from the unassigned queue</p>
        </div>

        <Card>
          <div className="global-worklist__filters">
            <div className="filter-group">
              <label>Client ID</label>
              <input
                type="text"
                placeholder="Filter by client ID"
                value={filters.clientId}
                onChange={(e) => handleFilterChange('clientId', e.target.value)}
                className="neo-input"
              />
            </div>

            <div className="filter-group">
              <label>Category</label>
              <input
                type="text"
                placeholder="Filter by category"
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="neo-input"
              />
            </div>

            <div className="filter-group">
              <label>Created From</label>
              <input
                type="date"
                value={filters.createdAtFrom}
                onChange={(e) => handleFilterChange('createdAtFrom', e.target.value)}
                className="neo-input"
              />
            </div>

            <div className="filter-group">
              <label>Created To</label>
              <input
                type="date"
                value={filters.createdAtTo}
                onChange={(e) => handleFilterChange('createdAtTo', e.target.value)}
                className="neo-input"
              />
            </div>

            <div className="filter-group">
              <label>SLA Status</label>
              <select
                value={filters.slaStatus}
                onChange={(e) => handleFilterChange('slaStatus', e.target.value)}
                className="neo-input"
              >
                <option value="">All</option>
                <option value="overdue">Overdue</option>
                <option value="due_soon">Due Soon (2 days)</option>
                <option value="on_track">On Track</option>
              </select>
            </div>

            <div className="filter-group">
              <Button
                variant="default"
                onClick={() => setFilters({
                  clientId: '',
                  category: '',
                  createdAtFrom: '',
                  createdAtTo: '',
                  slaStatus: '',
                  sortBy: 'slaDueDate',
                  sortOrder: 'asc',
                  page: 1,
                  limit: 20,
                })}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Bulk Actions Toolbar */}
          <div className="global-worklist__bulk-actions" style={{ 
            display: 'flex', 
            gap: '1rem', 
            alignItems: 'center',
            padding: '1rem',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <Button
              variant="primary"
              onClick={handleBulkPull}
              disabled={selectedCases.length === 0 || bulkPulling}
            >
              {bulkPulling ? 'Pulling...' : `Pull Cases (${selectedCases.length})`}
            </Button>
            <span className="text-secondary">
              {selectedCases.length} of {cases.length} selected
            </span>
          </div>

          {loading && <Loading message="Loading..." />}

          <div className="global-worklist__table-container">
            <table className="global-worklist__table">
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>
                    <input
                      type="checkbox"
                      checked={selectedCases.length === cases.length && cases.length > 0}
                      onChange={handleSelectAll}
                      disabled={cases.length === 0}
                    />
                  </th>
                  <th onClick={() => handleSort('caseId')} style={{ cursor: 'pointer' }}>
                    Case ID {getSortIcon('caseId')}
                  </th>
                  <th onClick={() => handleSort('clientId')} style={{ cursor: 'pointer' }}>
                    Client ID {getSortIcon('clientId')}
                  </th>
                  <th onClick={() => handleSort('category')} style={{ cursor: 'pointer' }}>
                    Category {getSortIcon('category')}
                  </th>
                  <th onClick={() => handleSort('slaDueDate')} style={{ cursor: 'pointer' }}>
                    SLA Due Date {getSortIcon('slaDueDate')}
                  </th>
                  <th>SLA Days Remaining</th>
                  <th onClick={() => handleSort('createdAt')} style={{ cursor: 'pointer' }}>
                    Created Date {getSortIcon('createdAt')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                      No unassigned cases found
                    </td>
                  </tr>
                ) : (
                  cases.map((caseItem) => (
                    <tr key={caseItem.caseId}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedCases.includes(caseItem.caseId)}
                          onChange={() => handleSelectCase(caseItem.caseId)}
                        />
                      </td>
                      <td>{caseItem.caseId}</td>
                      <td>{caseItem.clientId}</td>
                      <td>{caseItem.category}</td>
                      <td>{formatDate(caseItem.slaDueDate)}</td>
                      <td className={getSLAStatusClass(caseItem.slaDaysRemaining)}>
                        {caseItem.slaDaysRemaining !== null 
                          ? `${caseItem.slaDaysRemaining} days`
                          : 'N/A'}
                      </td>
                      <td>{formatDate(caseItem.createdAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <Button
                            variant="default"
                            size="small"
                            onClick={() => navigate(`/cases/${caseItem.caseId}`)}
                          >
                            View
                          </Button>
                          <Button
                            variant="primary"
                            size="small"
                            onClick={() => handlePullCase(caseItem.caseId)}
                            disabled={pullingCase === caseItem.caseId}
                          >
                            {pullingCase === caseItem.caseId ? 'Pulling...' : 'Pull'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination && pagination.pages > 1 && (
            <div className="global-worklist__pagination">
              <Button
                variant="default"
                disabled={pagination.page === 1}
                onClick={() => handleFilterChange('page', pagination.page - 1)}
              >
                Previous
              </Button>
              <span>
                Page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <Button
                variant="default"
                disabled={pagination.page === pagination.pages}
                onClick={() => handleFilterChange('page', pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};
