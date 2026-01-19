/**
 * Firms Management Page
 * SuperAdmin view for managing firms
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { superadminService } from '../services/superadminService';
import { SuperAdminLayout } from '../components/common/SuperAdminLayout';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Loading } from '../components/common/Loading';
import { useToast } from '../hooks/useToast';
import { STORAGE_KEYS, USER_ROLES } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import './FirmsManagement.css';

export const FirmsManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [loading, setLoading] = useState(true);
  const [firms, setFirms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    adminName: '',
    adminEmail: '',
  });

  // Verify user is Superadmin
  useEffect(() => {
    if (!user) {
      return;
    }
    if (user.role !== USER_ROLES.SUPER_ADMIN) {
      const fallbackSlug = user.firmSlug || localStorage.getItem(STORAGE_KEYS.FIRM_SLUG);
      navigate(fallbackSlug ? `/f/${fallbackSlug}/dashboard` : '/login', { replace: true });
    }
  }, [user, navigate]);

  // Load firms
  useEffect(() => {
    loadFirms();
  }, []);

  const loadFirms = async () => {
    try {
      setLoading(true);
      const response = await superadminService.listFirms();
      if (response?.status === 304) {
        return;
      }
      if (response?.success) {
        setFirms(Array.isArray(response.data) ? response.data : []);
      } else {
        toast.error('Failed to load firms');
      }
    } catch (error) {
      toast.error('Failed to load firms');
      console.error('Error loading firms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFirm = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.adminName.trim() || !formData.adminEmail.trim()) {
      toast.error('All fields are required');
      return;
    }
    
    try {
      setIsSubmitting(true);
      const response = await superadminService.createFirm(
        formData.name.trim(),
        formData.adminName.trim(),
        formData.adminEmail.trim()
      );
      
      if (response.success) {
        toast.success('Firm created successfully. Admin credentials have been emailed.');
        setFormData({ name: '', adminName: '', adminEmail: '' });
        setShowCreateModal(false);
        await loadFirms();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create firm');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleFirmStatus = async (firmId, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    
    try {
      const response = await superadminService.updateFirmStatus(firmId, newStatus);
      if (response.success) {
        toast.success(`Firm ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`);
        loadFirms();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update firm status');
    }
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <Loading message="Loading firms..." />
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="firms-management">
        <div className="firms-management__header">
          <div>
            <h1>Firms Management</h1>
            <p className="text-secondary">Manage firms and their lifecycle on the platform</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            + Create Firm
          </Button>
        </div>

        {/* Create Firm Modal */}
        {showCreateModal && (
          <div className="modal-overlay">
            <Card className="modal-card">
              <div className="modal-header">
                <h2>Create New Firm</h2>
                <button 
                  className="modal-close"
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: '', adminName: '', adminEmail: '' });
                    setIsSubmitting(false);
                  }}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCreateFirm} className="modal-form">
                <Input
                  label="Firm Name *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Enter firm name"
                />
                <Input
                  label="Admin Name *"
                  value={formData.adminName}
                  onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                  required
                  placeholder="Enter admin name"
                />
                <Input
                  label="Admin Email *"
                  type="email"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  required
                  placeholder="admin@example.com"
                />
                <div className="modal-actions">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Creating...' : 'Create Firm'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({ name: '', adminName: '', adminEmail: '' });
                      setIsSubmitting(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {/* Firms Table */}
        {firms.length === 0 ? (
          <Card className="empty-state">
            <div className="empty-state__icon">🏢</div>
            <h2>No firms yet</h2>
            <p>Create your first firm to begin using Docketra.</p>
            <Button onClick={() => setShowCreateModal(true)}>
              + Create Firm
            </Button>
          </Card>
        ) : (
          <Card>
            <div className="table-container">
              <table className="firms-table">
                <thead>
                  <tr>
                    <th>Firm Name</th>
                    <th>Status</th>
                    <th>Firm Login URL</th>
                    <th>Clients</th>
                    <th>Users</th>
                    <th>Created On</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {firms.map(firm => {
                    const statusLabel = firm.status || 'UNKNOWN';
                    const statusKey = statusLabel.toLowerCase();
                    const firmSlug = firm.firmSlug;
                    const loginUrl = firmSlug ? `${window.location.origin}/f/${firmSlug}/login` : null;
                    return (
                      <tr key={firm._id}>
                        <td>
                          <div className="firm-name">
                            <div className="firm-name__primary">{firm.name}</div>
                            <div className="firm-name__secondary">{firm.firmId}</div>
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge status-badge--${statusKey}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          {loginUrl ? (
                            <a 
                              href={loginUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="firm-login-url"
                              title="Open firm login page in new tab"
                            >
                              /f/{firmSlug}/login
                            </a>
                          ) : (
                            <span className="text-secondary">N/A</span>
                          )}
                        </td>
                        <td>{firm.clientCount ?? 0}</td>
                        <td>{firm.userCount ?? 0}</td>
                        <td>{formatDate(firm.createdAt)}</td>
                        <td>
                          {firm.status === 'ACTIVE' ? (
                            <Button
                              size="small"
                              variant="danger"
                              onClick={() => handleToggleFirmStatus(firm._id, firm.status)}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              variant="success"
                              onClick={() => handleToggleFirmStatus(firm._id, firm.status)}
                            >
                              Activate
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </SuperAdminLayout>
  );
};
