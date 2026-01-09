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
import { categoryService } from '../services/categoryService';
import { clientService } from '../services/clientService';
import { useToast } from '../hooks/useToast';
import './AdminPage.css';

export const AdminPage = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [pendingCases, setPendingCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showChangeNameModal, setShowChangeNameModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Admin stats (PR #41)
  const [adminStats, setAdminStats] = useState({
    totalUsers: 0,
    totalClients: 0,
    totalCategories: 0,
    pendingApprovals: 0,
  });

  // Create user form state (PR 32: xID is auto-generated, not user-provided)
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'Employee',
  });
  
  // Category form state
  const [categoryForm, setCategoryForm] = useState({
    name: '',
  });
  
  // Subcategory form state
  const [subcategoryForm, setSubcategoryForm] = useState({
    name: '',
  });

  // Client form state
  const [clientForm, setClientForm] = useState({
    businessName: '',
    businessAddress: '',
    primaryContactNumber: '',
    secondaryContactNumber: '',
    businessEmail: '',
    PAN: '',
    GST: '',
    TAN: '',
    CIN: '',
  });
  
  // Change name form state
  const [changeNameForm, setChangeNameForm] = useState({
    newBusinessName: '',
    reason: '',
  });

  useEffect(() => {
    loadAdminStats();
    loadAdminData();
  }, [activeTab]);

  const loadAdminStats = async () => {
    try {
      const response = await adminService.getAdminStats();
      if (response.success) {
        setAdminStats(response.data || {
          totalUsers: 0,
          totalClients: 0,
          totalCategories: 0,
          pendingApprovals: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load admin stats:', error);
      showToast('Failed to load admin statistics', 'error');
    }
  };

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
      } else if (activeTab === 'categories') {
        const response = await categoryService.getCategories(false); // Get all categories including inactive
        if (response.success) {
          setCategories(response.data || []);
        }
      } else if (activeTab === 'clients') {
        const response = await clientService.getClients(false); // Get all clients including inactive
        if (response.success) {
          setClients(response.data || []);
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
    
    // PR 32: Only name and email are required (xID is auto-generated)
    if (!newUser.name || !newUser.email) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    setCreatingUser(true);

    try {
      const response = await adminService.createUser(newUser);
      
      if (response.success) {
        showToast(`User created successfully! xID: ${response.data?.xID}. Invite email sent.`, 'success');
        setShowCreateModal(false);
        setNewUser({ name: '', email: '', role: 'Employee' });
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
  
  // Category Management Handlers
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    
    if (!categoryForm.name || !categoryForm.name.trim()) {
      showToast('Please enter a category name', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await categoryService.createCategory(categoryForm.name.trim());
      
      if (response.success) {
        showToast('Category created successfully', 'success');
        setShowCategoryModal(false);
        setCategoryForm({ name: '' });
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to create category', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to create category', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleToggleCategoryStatus = async (category) => {
    const newStatus = !category.isActive;
    const action = newStatus ? 'enable' : 'disable';
    
    try {
      const response = await categoryService.toggleCategoryStatus(category._id, newStatus);
      
      if (response.success) {
        showToast(`Category ${action}d successfully`, 'success');
        loadAdminData();
      } else {
        showToast(response.message || `Failed to ${action} category`, 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || `Failed to ${action} category`, 'error');
    }
  };
  
  const handleAddSubcategory = async (e) => {
    e.preventDefault();
    
    if (!subcategoryForm.name || !subcategoryForm.name.trim()) {
      showToast('Please enter a subcategory name', 'error');
      return;
    }
    
    if (!selectedCategory) {
      showToast('No category selected', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await categoryService.addSubcategory(
        selectedCategory._id,
        subcategoryForm.name.trim()
      );
      
      if (response.success) {
        showToast('Subcategory added successfully', 'success');
        setShowSubcategoryModal(false);
        setSubcategoryForm({ name: '' });
        setSelectedCategory(null);
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to add subcategory', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to add subcategory', 'error');
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleToggleSubcategoryStatus = async (category, subcategory) => {
    const newStatus = !subcategory.isActive;
    const action = newStatus ? 'enable' : 'disable';
    
    try {
      const response = await categoryService.toggleSubcategoryStatus(
        category._id,
        subcategory.id,
        newStatus
      );
      
      if (response.success) {
        showToast(`Subcategory ${action}d successfully`, 'success');
        loadAdminData();
      } else {
        showToast(response.message || `Failed to ${action} subcategory`, 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || `Failed to ${action} subcategory`, 'error');
    }
  };

  const handleDeleteCategory = async (category) => {
    if (!confirm(`Are you sure you want to delete category "${category.name}"? This is a soft delete - the category will be hidden from dropdowns but historical cases will remain valid.`)) {
      return;
    }
    
    try {
      const response = await categoryService.deleteCategory(category._id);
      
      if (response.success) {
        showToast('Category deleted successfully', 'success');
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to delete category', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete category', 'error');
    }
  };

  const handleDeleteSubcategory = async (category, subcategory) => {
    if (!confirm(`Are you sure you want to delete subcategory "${subcategory.name}"? This is a soft delete - the subcategory will be hidden from dropdowns but historical cases will remain valid.`)) {
      return;
    }
    
    try {
      const response = await categoryService.deleteSubcategory(category._id, subcategory.id);
      
      if (response.success) {
        showToast('Subcategory deleted successfully', 'success');
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to delete subcategory', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete subcategory', 'error');
    }
  };

  // Client Management Handlers
  const handleCreateClient = async (e) => {
    e.preventDefault();
    
    if (!clientForm.businessName || !clientForm.businessAddress || 
        !clientForm.primaryContactNumber || !clientForm.businessEmail) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Explicit payload construction - DO NOT spread form state
      const payload = {
        businessName: clientForm.businessName,
        businessAddress: clientForm.businessAddress,
        businessEmail: clientForm.businessEmail,
        primaryContactNumber: clientForm.primaryContactNumber,
        ...(clientForm.secondaryContactNumber && { secondaryContactNumber: clientForm.secondaryContactNumber }),
        ...(clientForm.PAN && { PAN: clientForm.PAN }),
        ...(clientForm.TAN && { TAN: clientForm.TAN }),
        ...(clientForm.GST && { GST: clientForm.GST }),
        ...(clientForm.CIN && { CIN: clientForm.CIN }),
      };
      
      // Frontend safety assertion - detect deprecated fields
      if ('latitude' in payload || 'longitude' in payload || 'businessPhone' in payload) {
        throw new Error('Deprecated fields detected in client payload');
      }
      
      const response = await clientService.createClient(payload);
      
      if (response.success) {
        showToast(`Client created successfully! Client ID: ${response.data?.clientId}`, 'success');
        setShowClientModal(false);
        setClientForm({
          businessName: '',
          businessAddress: '',
          primaryContactNumber: '',
          secondaryContactNumber: '',
          businessEmail: '',
          PAN: '',
          GST: '',
          TAN: '',
          CIN: '',
        });
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to create client', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || error.message || 'Failed to create client', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClient = (client) => {
    setSelectedClient(client);
    setClientForm({
      businessName: client.businessName,
      businessAddress: client.businessAddress,
      primaryContactNumber: client.primaryContactNumber || '',
      secondaryContactNumber: client.secondaryContactNumber || '',
      businessEmail: client.businessEmail,
      PAN: client.PAN || '',
      GST: client.GST || '',
      TAN: client.TAN || '',
      CIN: client.CIN || '',
    });
    setShowClientModal(true);
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    
    if (!selectedClient) {
      showToast('No client selected', 'error');
      return;
    }
    
    // Only allow updating email and contact numbers
    if (!clientForm.primaryContactNumber || !clientForm.businessEmail) {
      showToast('Primary contact number and business email are required', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      // Only send editable fields to backend
      const updateData = {
        businessEmail: clientForm.businessEmail,
        primaryContactNumber: clientForm.primaryContactNumber,
        secondaryContactNumber: clientForm.secondaryContactNumber,
      };
      
      const response = await clientService.updateClient(selectedClient.clientId, updateData);
      
      if (response.success) {
        showToast('Client updated successfully', 'success');
        setShowClientModal(false);
        setSelectedClient(null);
        setClientForm({
          businessName: '',
          businessAddress: '',
          primaryContactNumber: '',
          secondaryContactNumber: '',
          businessEmail: '',
          PAN: '',
          GST: '',
          TAN: '',
          CIN: '',
        });
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to update client', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to update client', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleClientStatus = async (client) => {
    // Use canonical status field (ACTIVE/INACTIVE)
    const isCurrentlyActive = client.status === 'ACTIVE';
    const newStatus = !isCurrentlyActive;
    const action = newStatus ? 'activate' : 'deactivate';
    
    try {
      const response = await clientService.toggleClientStatus(client.clientId, newStatus);
      
      if (response.success) {
        showToast(`Client ${action}d successfully`, 'success');
        loadAdminData();
      } else {
        showToast(response.message || `Failed to ${action} client`, 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || `Failed to ${action} client`, 'error');
    }
  };

  const handleOpenChangeNameModal = (client) => {
    setSelectedClient(client);
    setChangeNameForm({
      newBusinessName: '',
      reason: '',
    });
    setShowChangeNameModal(true);
  };

  const handleChangeLegalName = async (e) => {
    e.preventDefault();
    
    if (!selectedClient) {
      showToast('No client selected', 'error');
      return;
    }
    
    if (!changeNameForm.newBusinessName || !changeNameForm.newBusinessName.trim()) {
      showToast('New business name is required', 'error');
      return;
    }
    
    if (!changeNameForm.reason || !changeNameForm.reason.trim()) {
      showToast('Reason for name change is required for audit compliance', 'error');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const response = await clientService.changeLegalName(
        selectedClient.clientId,
        changeNameForm.newBusinessName.trim(),
        changeNameForm.reason.trim()
      );
      
      if (response.success) {
        showToast('Client legal name changed successfully', 'success');
        setShowChangeNameModal(false);
        setSelectedClient(null);
        setChangeNameForm({
          newBusinessName: '',
          reason: '',
        });
        loadAdminData();
      } else {
        showToast(response.message || 'Failed to change client name', 'error');
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to change client name', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseClientModal = () => {
    setShowClientModal(false);
    setSelectedClient(null);
    setClientForm({
      businessName: '',
      businessAddress: '',
      primaryContactNumber: '',
      secondaryContactNumber: '',
      businessEmail: '',
      PAN: '',
      GST: '',
      TAN: '',
      CIN: '',
    });
  };
  
  const handleCloseChangeNameModal = () => {
    setShowChangeNameModal(false);
    setSelectedClient(null);
    setChangeNameForm({
      newBusinessName: '',
      reason: '',
    });
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
            User Management ({adminStats.totalUsers})
          </Button>
          <Button
            variant={activeTab === 'clients' ? 'primary' : 'default'}
            onClick={() => setActiveTab('clients')}
          >
            Client Management ({adminStats.totalClients})
          </Button>
          <Button
            variant={activeTab === 'categories' ? 'primary' : 'default'}
            onClick={() => setActiveTab('categories')}
          >
            Categories ({adminStats.totalCategories})
          </Button>
          <Button
            variant={activeTab === 'approvals' ? 'primary' : 'default'}
            onClick={() => setActiveTab('approvals')}
          >
            Pending Approvals ({adminStats.pendingApprovals})
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

        {activeTab === 'clients' && (
          <Card>
            <div className="admin__section-header">
              <h2 className="neo-section__header">Client Management</h2>
              <Button
                variant="primary"
                onClick={() => {
                  setSelectedClient(null);
                  setClientForm({
                    businessName: '',
                    businessAddress: '',
                    primaryContactNumber: '',
                    secondaryContactNumber: '',
                    businessEmail: '',
                    PAN: '',
                    GST: '',
                    TAN: '',
                    CIN: '',
                  });
                  setShowClientModal(true);
                }}
              >
                + Create Client
              </Button>
            </div>
            
            {clients.length === 0 ? (
              <div className="admin__empty">
                <p className="text-secondary">No clients found</p>
              </div>
            ) : (
              <table className="neo-table">
                <thead>
                  <tr>
                    <th>Client ID</th>
                    <th>Business Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.clientId}>
                      <td>
                        {client.clientId}
                        {client.clientId === 'C000001' && (
                          <span style={{ marginLeft: '8px' }}>
                            <Badge status="Approved">Default</Badge>
                          </span>
                        )}
                      </td>
                      <td>{client.businessName}</td>
                      <td>{client.businessEmail}</td>
                      <td>{client.primaryContactNumber}</td>
                      <td>
                        <Badge status={client.status === 'ACTIVE' ? 'Approved' : 'Rejected'}>
                          {client.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>{new Date(client.createdAt).toLocaleDateString()}</td>
                      <td className="admin__actions">
                        <Button
                          size="small"
                          variant="default"
                          onClick={() => handleEditClient(client)}
                          disabled={client.isSystemClient}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          variant="warning"
                          onClick={() => handleOpenChangeNameModal(client)}
                          disabled={client.isSystemClient}
                        >
                          Change Name
                        </Button>
                        {/* Only show Activate/Deactivate button if NOT Default Client */}
                        {client.clientId !== 'C000001' && (
                          <Button
                            size="small"
                            variant={client.status === 'ACTIVE' ? 'danger' : 'success'}
                            onClick={() => handleToggleClientStatus(client)}
                          >
                            {client.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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

        {activeTab === 'categories' && (
          <Card>
            <div className="admin__section-header">
              <h2 className="neo-section__header">Category Management</h2>
              <Button
                variant="primary"
                onClick={() => setShowCategoryModal(true)}
              >
                + Create Category
              </Button>
            </div>
            
            {categories.length === 0 ? (
              <div className="admin__empty">
                <p className="text-secondary">No categories found</p>
              </div>
            ) : (
              <div className="categories-list">
                {categories.map((category) => (
                  <Card key={category._id} className="category-card">
                    <div className="category-header">
                      <div>
                        <h3>{category.name}</h3>
                        <Badge status={category.isActive ? 'Approved' : 'Rejected'}>
                          {category.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="category-actions">
                        <Button
                          size="small"
                          variant="default"
                          onClick={() => {
                            setSelectedCategory(category);
                            setShowSubcategoryModal(true);
                          }}
                        >
                          + Add Subcategory
                        </Button>
                        <Button
                          size="small"
                          variant={category.isActive ? 'danger' : 'success'}
                          onClick={() => handleToggleCategoryStatus(category)}
                        >
                          {category.isActive ? 'Disable' : 'Enable'}
                        </Button>
                        <Button
                          size="small"
                          variant="danger"
                          onClick={() => handleDeleteCategory(category)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    {category.subcategories && category.subcategories.length > 0 && (
                      <div className="subcategories-list">
                        <h4>Subcategories:</h4>
                        <table className="neo-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {category.subcategories.map((sub) => (
                              <tr key={sub.id}>
                                <td>{sub.name}</td>
                                <td>
                                  <Badge status={sub.isActive ? 'Approved' : 'Rejected'}>
                                    {sub.isActive ? 'Active' : 'Inactive'}
                                  </Badge>
                                </td>
                                <td>
                                  <Button
                                    size="small"
                                    variant={sub.isActive ? 'danger' : 'success'}
                                    onClick={() => handleToggleSubcategoryStatus(category, sub)}
                                  >
                                    {sub.isActive ? 'Disable' : 'Enable'}
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="danger"
                                    onClick={() => handleDeleteSubcategory(category, sub)}
                                  >
                                    Delete
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
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
          <div className="neo-form-group">
            <label className="neo-label">xID (Auto-Generated)</label>
            <div className="neo-info-text">
              Employee ID will be automatically generated (e.g., X000001)
            </div>
          </div>

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
      
      {/* Create Category Modal */}
      <Modal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setCategoryForm({ name: '' });
        }}
        title="Create New Category"
      >
        <form onSubmit={handleCreateCategory} className="admin__create-form">
          <Input
            label="Category Name"
            name="name"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            placeholder="Enter category name"
            required
          />

          <div className="neo-form-actions">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setShowCategoryModal(false);
                setCategoryForm({ name: '' });
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
      
      {/* Add Subcategory Modal */}
      <Modal
        isOpen={showSubcategoryModal}
        onClose={() => {
          setShowSubcategoryModal(false);
          setSubcategoryForm({ name: '' });
          setSelectedCategory(null);
        }}
        title={`Add Subcategory to ${selectedCategory?.name || ''}`}
      >
        <form onSubmit={handleAddSubcategory} className="admin__create-form">
          <Input
            label="Subcategory Name"
            name="name"
            value={subcategoryForm.name}
            onChange={(e) => setSubcategoryForm({ ...subcategoryForm, name: e.target.value })}
            placeholder="Enter subcategory name"
            required
          />

          <div className="neo-form-actions">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setShowSubcategoryModal(false);
                setSubcategoryForm({ name: '' });
                setSelectedCategory(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Subcategory'}
            </Button>
          </div>
        </form>
      </Modal>
      
      {/* Client Modal (Create/Edit) */}
      <Modal
        isOpen={showClientModal}
        onClose={handleCloseClientModal}
        title={selectedClient ? 'Edit Client' : 'Create New Client'}
      >
        <form onSubmit={selectedClient ? handleUpdateClient : handleCreateClient} className="admin__create-form">
          {selectedClient && (
            <div className="neo-form-group">
              <label className="neo-label">Client ID</label>
              <div className="neo-info-text">{selectedClient.clientId} (Immutable)</div>
            </div>
          )}

          <Input
            label="Business Name *"
            name="businessName"
            value={clientForm.businessName}
            onChange={(e) => setClientForm({ ...clientForm, businessName: e.target.value })}
            placeholder="Enter business name"
            required
            disabled={!!selectedClient}
            title={selectedClient ? 'Business name cannot be edited inline. Use "Change Legal Name" action.' : ''}
          />
          
          {selectedClient && (
            <div className="client-field-hint">
              To change business name, use the "Change Legal Name" button for audit compliance
            </div>
          )}

          <Input
            label="Business Address"
            name="businessAddress"
            value={clientForm.businessAddress}
            onChange={(e) => setClientForm({ ...clientForm, businessAddress: e.target.value })}
            placeholder="Enter business address"
            required={!selectedClient}
            disabled={!!selectedClient}
            title={selectedClient ? 'Address cannot be changed after creation' : ''}
          />

          <Input
            label="Primary Contact Number *"
            name="primaryContactNumber"
            type="tel"
            value={clientForm.primaryContactNumber}
            onChange={(e) => setClientForm({ ...clientForm, primaryContactNumber: e.target.value })}
            placeholder="Enter primary contact number"
            required
          />

          <Input
            label="Secondary Contact Number"
            name="secondaryContactNumber"
            type="tel"
            value={clientForm.secondaryContactNumber}
            onChange={(e) => setClientForm({ ...clientForm, secondaryContactNumber: e.target.value })}
            placeholder="Enter secondary contact number (optional)"
          />

          <Input
            label="Business Email *"
            name="businessEmail"
            type="email"
            value={clientForm.businessEmail}
            onChange={(e) => setClientForm({ ...clientForm, businessEmail: e.target.value })}
            placeholder="Enter business email"
            required
          />

          <Input
            label="PAN"
            name="PAN"
            value={clientForm.PAN}
            onChange={(e) => setClientForm({ ...clientForm, PAN: e.target.value })}
            placeholder="Enter PAN (optional)"
            disabled={!!selectedClient}
            title={selectedClient ? 'PAN is immutable and cannot be changed' : ''}
          />

          <Input
            label="TAN"
            name="TAN"
            value={clientForm.TAN}
            onChange={(e) => setClientForm({ ...clientForm, TAN: e.target.value })}
            placeholder="Enter TAN (optional)"
            disabled={!!selectedClient}
            title={selectedClient ? 'TAN is immutable and cannot be changed' : ''}
          />

          <Input
            label="CIN"
            name="CIN"
            value={clientForm.CIN}
            onChange={(e) => setClientForm({ ...clientForm, CIN: e.target.value })}
            placeholder="Enter CIN (optional)"
            disabled={!!selectedClient}
            title={selectedClient ? 'CIN is immutable and cannot be changed' : ''}
          />

          <Input
            label="GST"
            name="GST"
            value={clientForm.GST}
            onChange={(e) => setClientForm({ ...clientForm, GST: e.target.value })}
            placeholder="Enter GST (optional)"
            disabled={!!selectedClient}
            title={selectedClient ? 'GST cannot be changed after creation' : ''}
          />

          <div className="neo-form-actions">
            <Button
              type="button"
              variant="default"
              onClick={handleCloseClientModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? (selectedClient ? 'Updating...' : 'Creating...') : (selectedClient ? 'Update Client' : 'Create Client')}
            </Button>
          </div>
        </form>
      </Modal>
      
      {/* Change Legal Name Modal */}
      <Modal
        isOpen={showChangeNameModal}
        onClose={handleCloseChangeNameModal}
        title="Change Client Legal Name"
      >
        <form onSubmit={handleChangeLegalName} className="admin__create-form">
          {selectedClient && (
            <>
              <div className="neo-form-group">
                <label className="neo-label">Client ID</label>
                <div className="neo-info-text">{selectedClient.clientId}</div>
              </div>
              
              <div className="neo-form-group">
                <label className="neo-label">Current Business Name</label>
                <div className="neo-info-text client-current-name">{selectedClient.businessName}</div>
              </div>
            </>
          )}
          
          <div className="client-warning-box">
            <strong>⚠️ Important:</strong> Changing a client's legal name is a significant action. 
            This change will be permanently recorded in the audit trail with your user ID and the reason provided.
          </div>

          <Input
            label="New Business Name *"
            name="newBusinessName"
            value={changeNameForm.newBusinessName}
            onChange={(e) => setChangeNameForm({ ...changeNameForm, newBusinessName: e.target.value })}
            placeholder="Enter new business name"
            required
          />

          <div className="neo-form-group">
            <label className="neo-label">Reason for Name Change *</label>
            <textarea
              name="reason"
              value={changeNameForm.reason}
              onChange={(e) => setChangeNameForm({ ...changeNameForm, reason: e.target.value })}
              placeholder="Enter reason for legal name change (e.g., merger, rebranding, legal restructuring)"
              required
              rows="4"
              className="client-reason-textarea"
            />
          </div>

          <div className="neo-form-actions">
            <Button
              type="button"
              variant="default"
              onClick={handleCloseChangeNameModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="warning"
              disabled={submitting}
            >
              {submitting ? 'Changing Name...' : 'Confirm Name Change'}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
};
