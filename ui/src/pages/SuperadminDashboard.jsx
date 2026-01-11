/**
 * Superadmin Dashboard Page
 * Platform-level firm management
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { superadminService } from '../services/superadminService';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { useToast } from '../hooks/useToast';
import { USER_ROLES } from '../utils/constants';
import { formatDate } from '../utils/formatters';
import './SuperadminDashboard.css';

export const SuperadminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [firms, setFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateFirm, setShowCreateFirm] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newFirmName, setNewFirmName] = useState('');
  const [selectedFirm, setSelectedFirm] = useState(null);
  const [adminData, setAdminData] = useState({
    name: '',
    email: '',
    xID: '',
  });

  // Verify user is Superadmin
  useEffect(() => {
    if (!user || user.role !== USER_ROLES.SUPER_ADMIN) {
      navigate('/dashboard');
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
      if (response.success) {
        setFirms(response.data);
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
    
    if (!newFirmName.trim()) {
      toast.error('Firm name is required');
      return;
    }
    
    try {
      const response = await superadminService.createFirm(newFirmName.trim());
      if (response.success) {
        toast.success('Firm created successfully');
        setNewFirmName('');
        setShowCreateFirm(false);
        loadFirms();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create firm');
    }
  };

  const handleUpdateFirmStatus = async (firmId, newStatus) => {
    try {
      const response = await superadminService.updateFirmStatus(firmId, newStatus);
      if (response.success) {
        toast.success(`Firm ${newStatus === 'ACTIVE' ? 'activated' : 'suspended'} successfully`);
        loadFirms();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update firm status');
    }
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    
    if (!selectedFirm || !adminData.name || !adminData.email || !adminData.xID) {
      toast.error('All fields are required');
      return;
    }
    
    try {
      const response = await superadminService.createFirmAdmin(selectedFirm._id, adminData);
      if (response.success) {
        toast.success('Firm admin created successfully. Password setup email sent.');
        setAdminData({ name: '', email: '', xID: '' });
        setShowCreateAdmin(false);
        setSelectedFirm(null);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create firm admin');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login');
    }
  };

  if (loading) {
    return (
      <div className="superadmin-dashboard">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="superadmin-dashboard">
      <header className="superadmin-header">
        <div className="header-content">
          <h1>🔐 Superadmin Dashboard</h1>
          <div className="header-actions">
            <span className="user-info">{user?.email}</span>
            <Button onClick={handleLogout} variant="secondary">
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="superadmin-content">
        <div className="actions-bar">
          <Button onClick={() => setShowCreateFirm(true)}>
            + Create Firm
          </Button>
          <Button onClick={() => setShowCreateAdmin(true)} variant="secondary">
            + Create Firm Admin
          </Button>
        </div>

        {/* Create Firm Modal */}
        {showCreateFirm && (
          <Card className="modal-card">
            <h2>Create New Firm</h2>
            <form onSubmit={handleCreateFirm}>
              <Input
                label="Firm Name"
                value={newFirmName}
                onChange={(e) => setNewFirmName(e.target.value)}
                required
                placeholder="Enter firm name"
              />
              <div className="modal-actions">
                <Button type="submit">Create</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowCreateFirm(false);
                    setNewFirmName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Create Firm Admin Modal */}
        {showCreateAdmin && (
          <Card className="modal-card">
            <h2>Create Firm Admin</h2>
            <form onSubmit={handleCreateAdmin}>
              <div className="form-group">
                <label>Select Firm *</label>
                <select
                  value={selectedFirm?._id || ''}
                  onChange={(e) => {
                    const firm = firms.find(f => f._id === e.target.value);
                    setSelectedFirm(firm || null);
                  }}
                  required
                  className="form-select"
                >
                  <option value="">-- Select a firm --</option>
                  {firms.filter(f => f.status === 'ACTIVE').map(firm => (
                    <option key={firm._id} value={firm._id}>
                      {firm.name} ({firm.firmId})
                    </option>
                  ))}
                </select>
              </div>
              <Input
                label="Admin Name"
                value={adminData.name}
                onChange={(e) => setAdminData({ ...adminData, name: e.target.value })}
                required
                placeholder="Enter admin name"
              />
              <Input
                label="Admin Email"
                type="email"
                value={adminData.email}
                onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                required
                placeholder="Enter admin email"
              />
              <Input
                label="Admin xID"
                value={adminData.xID}
                onChange={(e) => setAdminData({ ...adminData, xID: e.target.value.toUpperCase() })}
                required
                placeholder="X123456"
                pattern="^X\d{6}$"
              />
              <div className="modal-actions">
                <Button type="submit">Create Admin</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowCreateAdmin(false);
                    setAdminData({ name: '', email: '', xID: '' });
                    setSelectedFirm(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Firms List */}
        <Card>
          <h2>Firms ({firms.length})</h2>
          <div className="firms-list">
            {firms.length === 0 ? (
              <p className="empty-message">No firms yet. Create one to get started.</p>
            ) : (
              <table className="firms-table">
                <thead>
                  <tr>
                    <th>Firm ID</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {firms.map(firm => (
                    <tr key={firm._id}>
                      <td>{firm.firmId}</td>
                      <td>{firm.name}</td>
                      <td>
                        <span className={`status-badge status-${firm.status.toLowerCase()}`}>
                          {firm.status}
                        </span>
                      </td>
                      <td>{formatDate(firm.createdAt)}</td>
                      <td>
                        {firm.status === 'ACTIVE' ? (
                          <Button
                            size="small"
                            variant="danger"
                            onClick={() => handleUpdateFirmStatus(firm._id, 'SUSPENDED')}
                          >
                            Suspend
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            variant="success"
                            onClick={() => handleUpdateFirmStatus(firm._id, 'ACTIVE')}
                          >
                            Activate
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
