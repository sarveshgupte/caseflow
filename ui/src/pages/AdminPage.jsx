/**
 * Admin Page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/common/Layout';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { Modal } from '../components/common/Modal';
import { Loading } from '../components/common/Loading';
import { adminService } from '../services/adminService';
import { useToast } from '../hooks/useToast';
import './AdminPage.css';

export const AdminPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [pendingCases, setPendingCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);

  // Create user form state
  const [newUser, setNewUser] = useState({
    xID: '',
    name: '',
    email: '',
    role: 'Employee',
  });

  useEffect(() => {
    loadAdminData();
  }, [activeTab]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'approvals') {
        const response = await adminService.getPendingApprovals();
        if (response.success) {
          setPendingCases(response.data || []);
        }
      } else if (activeTab === 'users') {
        const response = await adminService.getUsers();
        if (response.success) {
          setUsers(response.data || []);
        }
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseId) => {
    navigate(`/cases/${caseId}`);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!newUser.xID || !newUser.name || !newUser.email) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setCreatingUser(true);

    try {
      const response = await adminService.createUser(newUser);
      
      if (response.success) {
        showToast('User created successfully. Password setup email sent.', 'success');
        setShowCreateModal(false);
        setNewUser({ xID: '', name: '', email: '', role: 'Employee' });
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to create user', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create user', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleUserStatus = async (user) => {
    const newStatus = !user.isActive;
    const action = newStatus ? 'activate' : 'deactivate';

    try {
      const response = await adminService.updateUserStatus(user.xID, newStatus);
      
      if (response.success) {
        showToast(`User ${action}d successfully`, 'success');
        loadAdminData();
      } else {
        showToast(response.message || `Failed to ${action} user`, 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || `Failed to ${action} user`, 'error');
    }
  };

  const handleResendSetupEmail = async (xID) => {
    try {
      const response = await adminService.resendSetupEmail(xID);
      
      if (response.success) {
        showToast('Password setup email sent successfully', 'success');
      } else {
        showToast(response.message || 'Failed to send email', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to send email', 'error');
    }
  };

  const handleUnlockAccount = async (xID) => {
    try {
      const response = await adminService.unlockAccount(xID);
      
      if (response.success) {
        showToast('Account unlocked successfully', 'success');
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to unlock account', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to unlock account', 'error');
    }
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
            variant={activeTab === 'users' ? 'primary' : 'default'}
            onClick={() => setActiveTab('users')}
          >
            User Management ({users.length})
          </Button>
          <Button
            variant={activeTab === 'approvals' ? 'primary' : 'default'}
            onClick={() => setActiveTab('approvals')}
          >
            Pending Approvals ({pendingCases.length})
          </Button>
          <Button
            variant={activeTab === 'reports' ? 'primary' : 'default'}
            onClick={() => navigate('/admin/reports')}
          >
            Reports & MIS
          </Button>
        </div>

        {activeTab === 'users' && (
          <Card>
            <div className="admin__section-header">
              <h2 className="neo-section__header">User Management</h2>
              <Button
                variant="primary"
                onClick={() => setShowCreateModal(true)}
              >
                + Create User
              </Button>
            </div>
            
            {users.length === 0 ? (
              <div className="admin__empty">
                <p className="text-secondary">No users found</p>
              </div>
            ) : (
              <table className="neo-table">
                <thead>
                  <tr>
                    <th>xID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Password Set</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.xID}>
                      <td>{user.xID}</td>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <Badge status={user.role === 'Admin' ? 'InProgress' : 'Pending'}>
                          {user.role}
                        </Badge>
                      </td>
                      <td>
                        <Badge status={user.isActive ? 'Approved' : 'Rejected'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <Badge status={user.passwordSet ? 'Approved' : 'Pending'}>
                          {user.passwordSet ? 'Yes' : 'No'}
                        </Badge>
                      </td>
                      <td className="admin__actions">
                        <Button
                          size="small"
                          variant={user.isActive ? 'danger' : 'success'}
                          onClick={() => handleToggleUserStatus(user)}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        {!user.passwordSet && (
                          <Button
                            size="small"
                            variant="default"
                            onClick={() => handleResendSetupEmail(user.xID)}
                          >
                            Resend Email
                          </Button>
                        )}
                        {user.lockUntil && new Date(user.lockUntil) > new Date() && (
                          <Button
                            size="small"
                            variant="warning"
                            onClick={() => handleUnlockAccount(user.xID)}
                          >
                            Unlock
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

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
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New User"
      >
        <form onSubmit={handleCreateUser} className="admin__create-form">
          <Input
            label="xID"
            type="text"
            value={newUser.xID}
            onChange={(e) => setNewUser({ ...newUser, xID: e.target.value.toUpperCase() })}
            placeholder="X123456"
            required
          />

          <Input
            label="Name"
            type="text"
            value={newUser.name}
            onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
            placeholder="John Doe"
            required
          />

          <Input
            label="Email"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="john.doe@company.com"
            required
          />

          <Select
            label="Role"
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            options={[
              { value: 'Employee', label: 'Employee' },
              { value: 'Admin', label: 'Admin' },
            ]}
          />

          <div className="admin__form-actions">
            <Button
              type="button"
              variant="default"
              onClick={() => setShowCreateModal(false)}
              disabled={creatingUser}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={creatingUser}
            >
              {creatingUser ? 'Creating...' : 'Create User'}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};
